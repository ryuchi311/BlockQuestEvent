import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
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

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// GET - fetch all admin users (except password hash) and booth scan statistics
export async function GET(request: Request) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const supabase = getSupabase();
    // We only select the fields we need, omitting password_hash
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch quest completions to calculate scan counts per booth
    let boothScanCounts: Record<string, number> = {};
    try {
      const { data: compData } = await supabase
        .from("quest_completions")
        .select("quest_id");

      if (compData) {
        compData.forEach((c) => {
          if (c.quest_id && c.quest_id.startsWith("booth-")) {
            const key = c.quest_id.replace(/^booth-/, "");
            boothScanCounts[key] = (boothScanCounts[key] || 0) + 1;
          }
        });
      }
    } catch {}

    const usersWithStats = (data || []).map((u) => {
      const boothSlug = u.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const scanCount = boothScanCounts[boothSlug] || 0;
      return {
        ...u,
        scan_count: scanCount,
        is_active: scanCount >= 1,
      };
    });

    return NextResponse.json({ adminUsers: usersWithStats, boothScanCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - create a new admin user (Restricted to superadmin)
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: "Email, password, and full name are required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const hashed = hashPassword(password);

    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        email,
        password_hash: hashed,
        full_name,
        role: role ?? "admin",
        requires_password_change: true
      })
      .select("id, email, full_name, role, created_at, requires_password_change")
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: "An admin with this email already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ adminUser: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - update an existing admin user (Restricted to superadmin)
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, full_name, email, role, password } = body;

    if (!id) {
      return NextResponse.json({ error: "Admin id is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (password) {
      updates.password_hash = hashPassword(password);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("admin_users")
      .update(updates)
      .eq("id", id)
      .select("id, email, full_name, role, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "An admin with this email already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ adminUser: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - remove an admin user (Restricted to superadmin)
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Admin id is required." }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("admin_users").delete().eq("id", id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

