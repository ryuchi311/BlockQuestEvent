import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyPassword } from "../../../../utils/registration-password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let payload: { email?: string; password?: string };

  try {
    payload = await request.json();
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
    .from("admin_users")
    .select("id, email, password_hash, full_name, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to verify login." }, { status: 500 });
  }

  if (!data || !verifyPassword(password, data.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Do not send password_hash back to the client
  return NextResponse.json({
    message: "Login successful.",
    adminUser: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
    }
  });
}
