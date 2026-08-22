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

// POST - Create a new social mission (Restricted to superadmin / admin)
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { platform, title, description, url, button_text, button_color, sort_order, is_active } = body;

    if (!platform || !title || !url || !button_text || !button_color) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("social_missions")
      .insert([
        {
          platform,
          title,
          description,
          url,
          button_text,
          button_color,
          sort_order: sort_order || 0,
          is_active: is_active ?? true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ mission: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Remove a social mission (Restricted to superadmin / admin)
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Mission ID is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("social_missions").delete().eq("id", body.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - Update an existing social mission (Restricted to superadmin / admin)
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, platform, title, description, url, button_text, button_color, sort_order, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Mission ID is required" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (platform !== undefined) updatePayload.platform = platform;
    if (title !== undefined) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (url !== undefined) updatePayload.url = url;
    if (button_text !== undefined) updatePayload.button_text = button_text;
    if (button_color !== undefined) updatePayload.button_color = button_color;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("social_missions")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ mission: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
