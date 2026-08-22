import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "../../../../utils/admin-auth";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// GET — list all message notes (Admin requires auth, optional ?email= filter for quester status)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      const auth = verifyAdminAuth(request, ["superadmin", "admin", "verifier"]);
      if (!auth.authorized) {
        return unauthorizedResponse(auth.error, auth.status);
      }
    }

    const supabase = getSupabase();
    let query = supabase.from("quest_message_notes").select("*").order("created_at", { ascending: false });

    if (email) {
      query = query.ilike("user_email", email);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ messages: data || [] });
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
    return NextResponse.json({ messageNote: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a message note submission
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "verifier"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { id, status, rejection_reason, approved_by, admin_email } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const reviewer = approved_by || admin_email || auth.user?.fullName || "Admin";
    const updatePayload: Record<string, any> = {
      status,
      approved_by: reviewer,
      reviewed_at: new Date().toISOString(),
    };
    if (rejection_reason !== undefined) {
      updatePayload.rejection_reason = rejection_reason;
    }

    const supabase = getSupabase();

    // 1. Fetch from quest_message_notes
    const { data: msgData, error: fetchErr } = await supabase
      .from("quest_message_notes")
      .select("user_email, xp, status, quest_id")
      .eq("id", id)
      .single();

    if (fetchErr || !msgData) {
      return NextResponse.json({ error: "Message note not found in database." }, { status: 404 });
    }

    if (msgData.status === status) {
      return NextResponse.json({ messageNote: msgData });
    }

    // 2. Update status in quest_message_notes
    const { data, error } = await supabase
      .from("quest_message_notes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to update status." }, { status: 500 });
    }

    if (status === "Approved" && msgData) {
      const { data: user } = await supabase
        .from("registrations")
        .select("id, total_xp")
        .eq("email", msgData.user_email)
        .single();

      if (user) {
        if (msgData.status !== "Approved") {
          await supabase
            .from("registrations")
            .update({ total_xp: (user.total_xp || 0) + (msgData.xp || 0) })
            .eq("id", user.id);
        }

        const { error: compErr } = await supabase
          .from("quest_completions")
          .insert({
            quest_id: msgData.quest_id,
            registration_id: user.id,
            user_email: msgData.user_email,
            xp_awarded: msgData.xp,
          });
        if (compErr && compErr.code !== "23505") {
          console.warn("quest_completions insert notice:", compErr.message);
        }
      }
    } else if ((status === "Rejected" || status === "Pending") && msgData && msgData.status === "Approved") {
      const { data: user } = await supabase
        .from("registrations")
        .select("id, total_xp")
        .eq("email", msgData.user_email)
        .single();

      if (user) {
        await supabase
          .from("registrations")
          .update({ total_xp: Math.max(0, (user.total_xp || 0) - (msgData.xp || 0)) })
          .eq("id", user.id);

        await supabase
          .from("quest_completions")
          .delete()
          .eq("quest_id", msgData.quest_id)
          .eq("registration_id", user.id);
      }
    }

    return NextResponse.json({ messageNote: data });
  } catch (err: any) {
    console.error("PATCH error in messages:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
