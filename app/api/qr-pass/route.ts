import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { verifyPassword } from "../../../utils/registration-password";

export const runtime = "nodejs";

type QrPassPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let payload: QrPassPayload;

  try {
    payload = (await request.json()) as QrPassPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, email, password_hash, ticket_code")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to verify registration." }, { status: 400 });
  }

  if (!data || !verifyPassword(password, data.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const passCode = data.ticket_code || `BQF-${String(data.id).padStart(6, "0")}`;

  const qrDataUrl = await QRCode.toDataURL(passCode, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return NextResponse.json({
    message: "QR pass generated successfully.",
    passCode,
    qrDataUrl,
    fullName: data.full_name,
    email: data.email,
  });
}
