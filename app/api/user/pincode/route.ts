import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let body: { email?: string; pincode?: string; currentPincode?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const pincode = body.pincode?.trim() || "";
  const currentPincode = body.currentPincode?.trim() || "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!pincode || !/^\d{4,6}$/.test(pincode)) {
    return NextResponse.json({ error: "Security PIN must be 4 to 6 digits." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase
    .from("registrations")
    .select("id, pincode")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Attendee account not found." }, { status: 404 });
  }

  // If a PIN is already set, verify currentPincode
  if (data.pincode && data.pincode.trim() !== "") {
    if (data.pincode !== currentPincode) {
      return NextResponse.json({ error: "Current Security PIN is incorrect." }, { status: 401 });
    }
  }

  // Save new PIN
  const { error: updateError } = await supabase
    .from("registrations")
    .update({ pincode })
    .eq("id", data.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Failed to update Security PIN." }, { status: 500 });
  }

  return NextResponse.json({
    message: "Security PIN set successfully.",
    pincode,
    hasPin: true,
  });
}
