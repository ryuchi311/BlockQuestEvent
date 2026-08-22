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

// GET — fetch all quests ordered by sort_order (redacts secrets if not admin)
export async function GET(request: Request) {
  try {
    const auth = verifyAdminAuth(request);
    const isAdmin = auth.authorized;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fiesta_event_quests")
      .select("id, title, description, xp, status, category, action_label, action_url, requires_proof, requires_message, is_quiz, quiz_answer, quiz_options, correct_option_index, passcode, expires_at, depends_on_quest_id, sort_order, created_by, updated_by, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (isAdmin) {
      return NextResponse.json({ quests: data });
    }

    // Public view: Redact passcode and quiz answers
    const sanitizedQuests = (data || []).map((q: any) => ({
      ...q,
      has_passcode: !!q.passcode,
      passcode: undefined,
      quiz_answer: undefined,
      correct_option_index: undefined,
    }));

    return NextResponse.json({ quests: sanitizedQuests });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a new quest (Restricted to superadmin / admin)
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      xp,
      status,
      category,
      action_label,
      action_url,
      requires_proof,
      requires_message,
      is_quiz,
      quiz_answer,
      quiz_options,
      correct_option_index,
      passcode,
      expires_at,
      depends_on_quest_id,
      sort_order,
      admin_email
    } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "id and title are required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fiesta_event_quests")
      .insert({
        id,
        title,
        description,
        xp: xp ?? 0,
        status: status ?? "Soon",
        category: category ?? "onboarding",
        action_label,
        action_url,
        requires_proof: !!requires_proof,
        requires_message: !!requires_message,
        is_quiz: !!is_quiz,
        quiz_answer: quiz_answer || null,
        quiz_options: quiz_options || null,
        correct_option_index: correct_option_index ?? null,
        passcode: passcode || null,
        expires_at: expires_at || null,
        depends_on_quest_id: depends_on_quest_id || null,
        sort_order: sort_order ?? 99,
        created_by: body.admin_name || admin_email || auth.user?.fullName || "System",
        updated_by: body.admin_name || admin_email || auth.user?.fullName || "System",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ quest: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update an existing quest (Restricted to superadmin / admin)
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, admin_email, admin_name, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Quest id is required." }, { status: 400 });

    if (admin_name || admin_email || auth.user?.fullName) {
      updates.updated_by = admin_name || admin_email || auth.user?.fullName;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fiesta_event_quests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ quest: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove a quest (Restricted to superadmin / admin)
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Quest id is required." }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("fiesta_event_quests").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
