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
      .select("*")
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
    const { id, title, description, xp, status, category, action_label, action_url, sort_order } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "id and title are required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("fiesta_event_quests")
      .insert({ id, title, description, xp: xp ?? 0, status: status ?? "Soon", category: category ?? "onboarding", action_label, action_url, sort_order: sort_order ?? 99 })
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
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Quest id is required." }, { status: 400 });

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
