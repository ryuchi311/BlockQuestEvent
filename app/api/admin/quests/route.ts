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

// GET — fetch all quests ordered by sort_order
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fiesta_event_quests")
      .select("id, title, description, xp, status, category, action_label, action_url, requires_proof, requires_message, is_quiz, quiz_answer, quiz_options, correct_option_index, passcode, expires_at, depends_on_quest_id, sort_order, created_by, updated_by, created_at, updated_at")
      .order("sort_order", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ quests: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a new quest
export async function POST(request: Request) {
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
        created_by: admin_email || "System",
        updated_by: admin_email || "System",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ quest: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update an existing quest
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, admin_email, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Quest id is required." }, { status: 400 });

    if (admin_email) {
      updates.updated_by = admin_email;
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

// DELETE — remove a quest
export async function DELETE(request: Request) {
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
