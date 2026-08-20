import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashPassword } from "../../../utils/registration-password";

export const runtime = "nodejs";

type RegistrationPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  password?: string;
  terms?: boolean;
  dataGathering?: boolean;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 },
    );
  }

  let payload: RegistrationPayload;

  try {
    payload = (await request.json()) as RegistrationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const rawPhone = payload.phone?.trim() ?? "";
  const phone = rawPhone.replace(/[^\d+]/g, ""); // Keep only digits and +
  const organization = payload.organization?.trim() || null;
  const password = payload.password ?? "";

  if (!fullName || !email || !phone || !password || payload.terms !== true || payload.dataGathering !== true) {
    return NextResponse.json(
      { error: "Missing required registration details." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 1. Check existing email
  const { data: existingEmail } = await supabase
    .from("registrations")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    return NextResponse.json(
      { error: "That email is already registered." },
      { status: 400 },
    );
  }

  // 2. Check existing mobile phone number (normalized digits)
  const newPhoneNorm = phone.replace(/[^\d]/g, "").replace(/^(63|0)/, "");
  const { data: existingPhones } = await supabase
    .from("registrations")
    .select("id, phone");

  const phoneDuplicate = existingPhones?.some((r) => {
    const existingNorm = (r.phone || "").replace(/[^\d]/g, "").replace(/^(63|0)/, "");
    return existingNorm && newPhoneNorm && existingNorm === newPhoneNorm;
  });

  if (phoneDuplicate) {
    return NextResponse.json(
      { error: "That mobile phone number is already registered to another attendee account." },
      { status: 400 },
    );
  }

  // 3. Insert registration record
  const { error } = await supabase.from("registrations").insert({
    full_name: fullName,
    email,
    phone,
    organization,
    password_hash: hashPassword(password),
    agreed_to_terms: true,
    agreed_to_data_gathering: true,
    agreed_at: new Date().toISOString(),
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "That email or phone number is already registered."
        : error.message || "Unable to store registration.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json(
    { message: "Registration saved successfully." },
    { status: 201 },
  );
}
