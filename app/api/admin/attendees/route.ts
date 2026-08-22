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

export async function GET(request: Request) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, organization, ticket_code, checked_in, checked_in_at, agreed_at, created_at, pincode")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendees: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "manage_attendees"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id, tempPin } = body;
    if (!id) return NextResponse.json({ error: "Attendee ID is required." }, { status: 400 });

    // Generate random 4-digit PIN if tempPin not supplied
    const finalPin = tempPin?.trim() || Math.floor(1000 + Math.random() * 9000).toString();

    if (!/^\d{4,6}$/.test(finalPin)) {
      return NextResponse.json({ error: "Temporary PIN must be 4 to 6 digits." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("registrations")
      .update({ pincode: finalPin })
      .eq("id", id)
      .select("id, full_name, email, pincode")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      message: "Security PIN reset successfully.",
      tempPin: finalPin,
      attendee: data
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Attendee ID is required." }, { status: 400 });

    const supabase = getSupabase();

    // 1. Fetch attendee info (email, id)
    const { data: attendee, error: fetchErr } = await supabase
      .from("registrations")
      .select("id, email, full_name")
      .eq("id", id)
      .single();

    if (fetchErr || !attendee) {
      return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
    }

    // 2. Cascade delete related records across all tables:
    // a. Delete quest_completions
    await supabase.from("quest_completions").delete().eq("registration_id", id);

    // b. Delete quest_verifications
    await supabase.from("quest_verifications").delete().eq("user_email", attendee.email);

    // c. Delete quest_message_notes (if table exists)
    try {
      await supabase.from("quest_message_notes").delete().eq("user_email", attendee.email);
    } catch {}

    // d. Delete booth_scans / booth_logs (if table exists)
    try {
      await supabase.from("booth_scans").delete().eq("registration_id", id);
    } catch {}

    // 3. Delete attendee from registrations table
    const { error: delErr } = await supabase
      .from("registrations")
      .delete()
      .eq("id", id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Attendee ${attendee.full_name} and all related Zealy quest records deleted successfully.`,
      id: attendee.id
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
