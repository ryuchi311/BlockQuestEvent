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

// GET — look up a ticket code without marking as checked in (preview)
export async function GET(request: Request) {
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

// POST — mark attendee as checked in
export async function POST(request: Request) {
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
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("id", attendee.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      valid: true,
      already_checked_in: false,
      attendee: { ...attendee, checked_in: true, checked_in_at: new Date().toISOString() },
      message: "Check-in successful! Attendee verified at entrance gate. Quest unlocked for manual claim! 🎉",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
