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

// GET - fetch all promo codes
export async function GET(request: Request) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promoCodes: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - create a new promo code
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { code, xp_bonus, max_uses, is_active } = body;

    if (!code) {
      return NextResponse.json({ error: "Promo code is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("promo_codes")
      .insert({
        code: code.trim().toUpperCase(),
        xp_bonus: xp_bonus || 150,
        max_uses: max_uses || null,
        is_active: is_active ?? true,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: "This promo code already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ promoCode: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - update a promo code
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, code, xp_bonus, max_uses, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Promo code ID is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (xp_bonus !== undefined) updates.xp_bonus = xp_bonus;
    if (max_uses !== undefined) updates.max_uses = max_uses;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("promo_codes")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: "This promo code already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ promoCode: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - remove a promo code
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Promo code ID is required." }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
