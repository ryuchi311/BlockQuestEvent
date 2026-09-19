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

// Fallback default tiers in case database is empty
const DEFAULT_MILESTONES = [
  { name: "Rookie Quester", xp: 500, icon: "🥉", color: "#cd7f32", sort_order: 1 },
  { name: "Explorer", xp: 1200, icon: "🥈", color: "#94a3b8", sort_order: 2 },
  { name: "Challenger", xp: 2500, icon: "⚔️", color: "#34d399", sort_order: 3 },
  { name: "Master Quester", xp: 5000, icon: "🥇", color: "#ffd700", sort_order: 4 },
  { name: "Diamond Hero", xp: 10000, icon: "💎", color: "#38bdf8", sort_order: 5 },
  { name: "Fiesta Legend", xp: 20000, icon: "👑", color: "#c084fc", sort_order: 6 },
  { name: "Grandmaster", xp: 35000, icon: "⚡", color: "#fbbf24", sort_order: 7 },
  { name: "Mythic Sovereign", xp: 50000, icon: "🌌", color: "#f472b6", sort_order: 8 },
];

// GET - fetch all milestones (publicly viewable, attendees & admins)
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("xp", { ascending: true });

    if (error) {
      console.warn("Could not query milestones table, falling back to defaults:", error.message);
      return NextResponse.json({ milestones: DEFAULT_MILESTONES });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ milestones: DEFAULT_MILESTONES });
    }

    return NextResponse.json({ milestones: data });
  } catch (err: any) {
    return NextResponse.json({ milestones: DEFAULT_MILESTONES, warning: err.message }, { status: 200 });
  }
}

// POST - create a new milestone tier (Restricted to superadmin / admin / manager)
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { name, xp, icon, color, sort_order } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Milestone name is required." }, { status: 400 });
    }

    const xpNum = Number(xp);
    if (isNaN(xpNum) || xpNum < 0) {
      return NextResponse.json({ error: "Valid XP requirement (0 or greater) is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .insert({
        name: name.trim(),
        xp: Math.round(xpNum),
        icon: (icon && icon.trim()) || "🥉",
        color: (color && color.trim()) || "#ffd700",
        sort_order: sort_order !== undefined ? Number(sort_order) : 0,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ milestone: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - update an existing milestone tier (Restricted to superadmin / admin / manager)
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, name, xp, icon, color, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: "Milestone ID is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: "Milestone name cannot be empty." }, { status: 400 });
      updates.name = name.trim();
    }
    if (xp !== undefined) {
      const xpNum = Number(xp);
      if (isNaN(xpNum) || xpNum < 0) return NextResponse.json({ error: "Valid XP requirement is required." }, { status: 400 });
      updates.xp = Math.round(xpNum);
    }
    if (icon !== undefined) updates.icon = icon.trim() || "🏆";
    if (color !== undefined) updates.color = color.trim() || "#ffd700";
    if (sort_order !== undefined) updates.sort_order = Number(sort_order);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("milestones")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ milestone: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - remove a milestone tier (Restricted to superadmin / admin / manager)
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Milestone ID is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("milestones").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
