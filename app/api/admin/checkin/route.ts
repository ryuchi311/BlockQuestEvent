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

// GET — look up a ticket code without marking as checked in (preview)
export async function GET(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "manage_attendees", "gate", "viewer"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Ticket code is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, organization, ticket_code, checked_in, checked_in_at, created_at")
      .eq("ticket_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ valid: false, error: "Ticket not found." }, { status: 404 });
    }

    return NextResponse.json({ valid: true, attendee: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — mark attendee as checked in (Restricted to gate staff & admins)
export async function POST(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "manage_attendees", "gate"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { ticket_code } = await request.json();
    const code = ticket_code?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Ticket code is required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // First, fetch the attendee
    const { data: attendee, error: fetchError } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, organization, ticket_code, checked_in, checked_in_at")
      .eq("ticket_code", code)
      .single();

    if (fetchError || !attendee) {
      return NextResponse.json({ valid: false, error: "Ticket not found." }, { status: 404 });
    }

    if (attendee.checked_in) {
      return NextResponse.json({
        valid: true,
        already_checked_in: true,
        attendee,
        message: `Already checked in at ${new Date(attendee.checked_in_at).toLocaleString("en-PH")}`,
      });
    }

    // Mark as checked in
    const checkinTime = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ checked_in: true, checked_in_at: checkinTime })
      .eq("id", attendee.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Auto-grant check-in quest reward (+500 XP) to ensure Zealy syncs immediately
    try {
      const { data: existingComp } = await supabase
        .from("quest_completions")
        .select("id")
        .eq("registration_id", attendee.id)
        .eq("quest_id", "checkin")
        .maybeSingle();

      if (!existingComp) {
        await supabase.from("quest_completions").insert({
          quest_id: "checkin",
          registration_id: attendee.id,
          xp_awarded: 500,
        });

        if (attendee.email) {
          await supabase.from("quest_verifications").insert({
            quest_id: "checkin",
            quest_title: "Physical Gate Check-in",
            user_name: attendee.full_name || undefined,
            user_email: attendee.email.trim().toLowerCase(),
            xp: 500,
            proof_url: "Gate QR Scan Check-in",
            user_message: "Auto-claimed upon entrance gate check-in",
            status: "Approved",
            approved_by: "Gate System",
            reviewed_at: checkinTime,
          });
        }

        // Recalculate total XP
        const { data: allComps } = await supabase
          .from("quest_completions")
          .select("xp_awarded")
          .eq("registration_id", attendee.id);

        const newTotalXp = (allComps || []).reduce((sum: number, c: any) => sum + (c.xp_awarded || 0), 0);
        await supabase
          .from("registrations")
          .update({ total_xp: newTotalXp })
          .eq("id", attendee.id);
      }
    } catch (checkinQuestErr) {
      console.warn("Could not auto-grant checkin quest on gate scan:", checkinQuestErr);
    }

    return NextResponse.json({
      valid: true,
      already_checked_in: false,
      attendee: { ...attendee, checked_in: true, checked_in_at: checkinTime },
      message: "Check-in successful! Attendee verified at entrance gate and +500 XP quest awarded! 🎉",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
