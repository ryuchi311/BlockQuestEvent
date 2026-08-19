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

      // Check for existing record for this quest+user, update if found
      const { data: existing } = await supabase
        .from("quest_message_notes")
        .select("id")
        .eq("quest_id", quest_id)
        .ilike("user_email", newRecord.user_email)
        .order("created_at", { ascending: false })
        .limit(1);

      let data, error;
      if (existing && existing.length > 0) {
        const res = await supabase
          .from("quest_message_notes")
          .update({
            user_message: trimmedMsg,
            status: "Pending",
            rejection_reason: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existing[0].id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from("quest_message_notes")
          .insert(newRecord)
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("quest_message_notes upsert error:", error);
        return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
      }
      if (data) {
        return NextResponse.json({ messageNote: data }, { status: 201 });
      }
    } catch (err: any) {
      console.error("DB error in messages POST:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a message note submission (with optional rejection reason & admin attribution)
export async function PATCH(request: Request) {
  try {
    const { id, status, rejection_reason, approved_by, admin_email } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const reviewer = approved_by || admin_email || "Admin";
    const updatePayload: Record<string, any> = {
      status,
      approved_by: reviewer,
      reviewed_at: new Date().toISOString(),
    };
    if (rejection_reason !== undefined) {
      updatePayload.rejection_reason = rejection_reason;
    }

    try {
      const supabase = getSupabase();

      // 1. Fetch from quest_message_notes
      let currentMsg: any = null;

      const { data: msgData } = await supabase
        .from("quest_message_notes")
        .select("user_email, xp, status, quest_id")
        .eq("id", id)
        .single();

      if (msgData) {
        currentMsg = msgData;
      }

      if (!currentMsg) {
        return NextResponse.json({ error: "Message note not found in database." }, { status: 404 });
      }

      if (currentMsg.status === status) {
        return NextResponse.json({ messageNote: currentMsg });
      }

      // 2. Update status in quest_message_notes
      const { data, error } = await supabase
        .from("quest_message_notes")
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

            // Use registration_id (not user_email) for quest_completions
            const { error: compErr } = await supabase
              .from("quest_completions")
              .insert({
                quest_id: currentMsg.quest_id,
                registration_id: user.id,
                xp_awarded: currentMsg.xp,
              });
            if (compErr && compErr.code !== "23505") {
              console.warn("quest_completions insert notice:", compErr.message);
            }
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
              .eq("registration_id", user.id);
          }
        }

        return NextResponse.json({ messageNote: data });
      }
    } catch (err: any) {
      console.error("PATCH error in messages:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
