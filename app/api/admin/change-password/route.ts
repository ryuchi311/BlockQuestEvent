import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { verifyPassword } from "../../../../utils/registration-password";

export const runtime = "nodejs";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let payload: { email?: string; oldPassword?: string; newPassword?: string };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const oldPassword = payload.oldPassword ?? "";
  const newPassword = payload.newPassword ?? "";

  if (!email || !oldPassword || !newPassword) {
    return NextResponse.json({ error: "Email, old password, and new password are required." }, { status: 400 });
  }
  
  if (oldPassword === newPassword) {
      return NextResponse.json({ error: "New password cannot be the same as the old password." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Verify old password
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to verify user." }, { status: 500 });
  }

  if (!verifyPassword(oldPassword, data.password_hash)) {
    return NextResponse.json({ error: "Incorrect current password." }, { status: 401 });
  }

  // Hash new password
  const newHashed = hashPassword(newPassword);

  // Update password and clear requires_password_change
  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ 
        password_hash: newHashed,
        requires_password_change: false
    })
    .eq("id", data.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }

  return NextResponse.json({ message: "Password updated successfully." });
}
