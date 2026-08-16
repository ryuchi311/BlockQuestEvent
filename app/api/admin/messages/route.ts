import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// In-memory fallback array for dev/demo when Supabase table isn't migrated yet
let memoryMessageNotes: any[] = [];

// GET — list all message notes (optional ?email= filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    try {
      const supabase = getSupabase();
      let query = supabase.from("quest_message_notes").select("*").order("created_at", { ascending: false });

      if (email) {
        query = query.ilike("user_email", email);
      }

      const { data, error } = await query;
      if (!error && data) {
        return NextResponse.json({ messages: data });
      }

      // Fallback query to quest_verifications if quest_message_notes table isn't created yet
      let verifQuery = supabase
        .from("quest_verifications")
        .select("*")
        .not("user_message", "is", null)
        .order("created_at", { ascending: false });

      if (email) {
        verifQuery = verifQuery.ilike("user_email", email);
      }
      const { data: verifData } = await verifQuery;
      if (verifData) {
        return NextResponse.json({ messages: verifData });
      }
    } catch (dbErr: any) {
      console.warn("DB query warning for quest_message_notes:", dbErr.message);
    }

    const filtered = email
      ? memoryMessageNotes.filter((v) => v.user_email?.toLowerCase() === email)
      : memoryMessageNotes;
    return NextResponse.json({ messages: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — user submits a Messagebox note
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, quest_title, user_name, user_email, ticket_code, xp, user_message } = body;

    if (!quest_id || !user_message) {
      return NextResponse.json({ error: "quest_id and user_message are required." }, { status: 400 });
    }

    const trimmedMsg = String(user_message).trim().slice(0, 50);

    const newRecord = {
      quest_id,
      quest_title: quest_title || "Message Quest",
      user_name: user_name || "Registered Quester",
      user_email: (user_email || "quester@blockquest.ph").trim().toLowerCase(),
      ticket_code: ticket_code || "BQF-GUEST",
      xp: xp || 100,
      user_message: trimmedMsg,
      status: "Pending",
      rejection_reason: null,
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("quest_message_notes")
        .insert(newRecord)
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ messageNote: data }, { status: 201 });
      }

      // Fallback insert to quest_verifications if table not migrated
      const { data: fallbackData } = await supabase
        .from("quest_verifications")
        .insert({
          ...newRecord,
          proof_url: "Message Submission",
        })
        .select()
        .single();

      if (fallbackData) {
        return NextResponse.json({ messageNote: fallbackData }, { status: 201 });
      }
    } catch (err: any) {
      console.warn("DB insert fallback notice:", err.message);
    }

    const memoryRecord = { id: Date.now(), ...newRecord };
    memoryMessageNotes.unshift(memoryRecord);
    return NextResponse.json({ messageNote: memoryRecord }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a message note submission
export async function PATCH(request: Request) {
  try {
    const { id, status, rejection_reason } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const updatePayload: Record<string, any> = { status };
    if (rejection_reason !== undefined) {
      updatePayload.rejection_reason = rejection_reason;
    }

    try {
      const supabase = getSupabase();

      // 1. Fetch from quest_message_notes or quest_verifications
      let currentMsg: any = null;
      let targetTable = "quest_message_notes";

      const { data: msgData } = await supabase
        .from("quest_message_notes")
        .select("user_email, xp, status, quest_id")
        .eq("id", id)
        .single();

      if (msgData) {
        currentMsg = msgData;
      } else {
        const { data: verifData } = await supabase
          .from("quest_verifications")
          .select("user_email, xp, status, quest_id")
          .eq("id", id)
          .single();
        if (verifData) {
          currentMsg = verifData;
          targetTable = "quest_verifications";
        }
      }

      if (currentMsg && currentMsg.status === status) {
        return NextResponse.json({ messageNote: currentMsg });
      }

      // 2. Update status in DB
      const { data, error } = await supabase
        .from(targetTable)
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        if (status === "Approved" && currentMsg) {
          const { data: user } = await supabase
            .from("registrations")
            .select("id, total_xp")
            .eq("email", currentMsg.user_email)
            .single();

          if (user) {
            if (currentMsg.status !== "Approved") {
              await supabase
                .from("registrations")
                .update({ total_xp: (user.total_xp || 0) + (currentMsg.xp || 0) })
                .eq("id", user.id);
            }

            await supabase
              .from("quest_completions")
              .insert({
                quest_id: currentMsg.quest_id,
                user_email: currentMsg.user_email,
                xp_awarded: currentMsg.xp,
              });
          }
        } else if ((status === "Rejected" || status === "Pending") && currentMsg && currentMsg.status === "Approved") {
          const { data: user } = await supabase
            .from("registrations")
            .select("id, total_xp")
            .eq("email", currentMsg.user_email)
            .single();

          if (user) {
            await supabase
              .from("registrations")
              .update({ total_xp: Math.max(0, (user.total_xp || 0) - (currentMsg.xp || 0)) })
              .eq("id", user.id);

            await supabase
              .from("quest_completions")
              .delete()
              .eq("quest_id", currentMsg.quest_id)
              .eq("user_email", currentMsg.user_email);
          }
        }

        return NextResponse.json({ messageNote: data });
      }
    } catch (err: any) {
      console.warn("PATCH fallback warning:", err.message);
    }

    memoryMessageNotes = memoryMessageNotes.map((item) =>
      item.id === id ? { ...item, status, rejection_reason: rejection_reason || null } : item
    );
    const updated = memoryMessageNotes.find((item) => item.id === id);
    return NextResponse.json({ messageNote: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
