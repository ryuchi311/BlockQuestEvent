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

// In-memory fallback tracking when table migrations are not present
let memoryBoothScans: Array<{
  booth_id: string;
  user_email: string;
  points: number;
  scanned_at: string;
}> = [];

// GET — preview attendee and check if booth points were already awarded
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const boothId = searchParams.get("booth_id")?.trim().toLowerCase() || "general-booth";

  if (!code) {
    return NextResponse.json({ error: "Ticket code is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: attendee, error } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, organization, ticket_code, total_xp, checked_in")
      .eq("ticket_code", code)
      .single();

    if (error || !attendee) {
      return NextResponse.json({ valid: false, error: "Ticket not found." }, { status: 404 });
    }

    // Check if this booth quest / visit has already been claimed
    const questId = `booth-${boothId}`;
    let alreadyVisited = false;
    let awardedAt: string | null = null;
    let awardedXp = 0;

    try {
      const { data: comp } = await supabase
        .from("quest_completions")
        .select("id, xp_awarded, created_at")
        .eq("quest_id", questId)
        .eq("registration_id", attendee.id)
        .maybeSingle();

      if (comp) {
        alreadyVisited = true;
        awardedAt = comp.created_at;
        awardedXp = comp.xp_awarded || 0;
      }
    } catch {
      // Memory fallback check
      const mem = memoryBoothScans.find(
        (m) => m.booth_id === boothId && m.user_email === attendee.email
      );
      if (mem) {
        alreadyVisited = true;
        awardedAt = mem.scanned_at;
        awardedXp = mem.points;
      }
    }

    return NextResponse.json({
      valid: true,
      attendee,
      already_visited: alreadyVisited,
      awarded_at: awardedAt,
      awarded_xp: awardedXp,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — award booth visit points to the attendee
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = body.ticket_code?.trim().toUpperCase();
    const boothId = (body.booth_id || "general-booth").trim().toLowerCase();
    const boothName = (body.booth_name || "Partner Booth").trim();
    const points = Number(body.points) || 100; // Fixed score per visit (default 100 XP)

    if (!code) {
      return NextResponse.json({ error: "Ticket code is required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Fetch attendee
    const { data: attendee, error: fetchError } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, organization, ticket_code, total_xp")
      .eq("ticket_code", code)
      .single();

    if (fetchError || !attendee) {
      return NextResponse.json({ valid: false, error: "Attendee ticket not found." }, { status: 404 });
    }

    const questId = `booth-${boothId}`;

    // 2. Check if already claimed from database
    try {
      const { data: existingComp } = await supabase
        .from("quest_completions")
        .select("id, xp_awarded, created_at")
        .eq("quest_id", questId)
        .eq("registration_id", attendee.id)
        .maybeSingle();

      if (existingComp) {
        return NextResponse.json({
          valid: true,
          already_visited: true,
          attendee,
          booth_name: boothName,
          xp_awarded: existingComp.xp_awarded,
          awarded_at: existingComp.created_at,
          message: `Already visited this booth! Points (+${existingComp.xp_awarded} XP) were awarded earlier.`,
        });
      }

      // 3. Record quest completion (atomic unique constraint ensures single claim)
      const { error: insertError } = await supabase
        .from("quest_completions")
        .insert({
          quest_id: questId,
          registration_id: attendee.id,
          xp_awarded: points,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json({
            valid: true,
            already_visited: true,
            attendee,
            booth_name: boothName,
            xp_awarded: points,
            message: `Already scanned at this booth! Points already recorded.`,
          });
        }
        throw insertError;
      }

      // 4. Recalculate exact total XP
      const { data: compList } = await supabase
        .from("quest_completions")
        .select("xp_awarded")
        .eq("registration_id", attendee.id);

      const { data: verifList } = await supabase
        .from("quest_verifications")
        .select("xp")
        .eq("user_email", attendee.email)
        .eq("status", "Approved");

      const compXp = (compList || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
      const verifXp = (verifList || []).reduce((sum, v) => sum + (v.xp || 0), 0);
      const newTotalXp = compXp + verifXp;

      await supabase
        .from("registrations")
        .update({ total_xp: newTotalXp })
        .eq("id", attendee.id);

      return NextResponse.json({
        valid: true,
        already_visited: false,
        attendee: { ...attendee, total_xp: newTotalXp },
        booth_name: boothName,
        xp_awarded: points,
        total_xp: newTotalXp,
        message: `Success! +${points} XP awarded to ${attendee.full_name} for visiting ${boothName}! 🎉`,
      });
    } catch (dbErr: any) {
      console.warn("DB operation failed, using in-memory tracker:", dbErr.message);

      const existingMem = memoryBoothScans.find(
        (m) => m.booth_id === boothId && m.user_email === attendee.email
      );
      if (existingMem) {
        return NextResponse.json({
          valid: true,
          already_visited: true,
          attendee,
          booth_name: boothName,
          xp_awarded: existingMem.points,
          awarded_at: existingMem.scanned_at,
          message: `Already visited this booth! Points were awarded earlier.`,
        });
      }

      memoryBoothScans.push({
        booth_id: boothId,
        user_email: attendee.email,
        points,
        scanned_at: new Date().toISOString(),
      });

      const updatedTotal = (attendee.total_xp || 0) + points;

      return NextResponse.json({
        valid: true,
        already_visited: false,
        attendee: { ...attendee, total_xp: updatedTotal },
        booth_name: boothName,
        xp_awarded: points,
        total_xp: updatedTotal,
        message: `Success! +${points} XP awarded to ${attendee.full_name}! 🎉`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
