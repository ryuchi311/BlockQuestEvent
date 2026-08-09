import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyPassword } from "../../../utils/registration-password";

export const runtime = "nodejs";

type LoginPayload = {
  email?: string;
  phone?: string;
  password?: string;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const rawPhone = payload.phone?.trim() ?? "";
  const phone = rawPhone.replace(/[^\d+]/g, ""); // Keep only digits and +
  const password = payload.password ?? "";

  if (!email || !phone || !password) {
    return NextResponse.json({ error: "Email, phone, and password are required." }, { status: 400 });
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
    .select("id, full_name, email, phone, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to verify login." }, { status: 400 });
  }

  const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").replace(/^(63|0)/, "");
  const normalizedInputPhone = normalizePhone(rawPhone);
  const normalizedDbPhone = data ? normalizePhone(data.phone || "") : "";

  if (!data || !verifyPassword(password, data.password_hash) || normalizedDbPhone !== normalizedInputPhone) {
    return NextResponse.json({ error: "Invalid email or phone number." }, { status: 401 });
  }

  return NextResponse.json({
    message: "Login successful.",
    fullName: data.full_name,
    email: data.email,
  });
}
