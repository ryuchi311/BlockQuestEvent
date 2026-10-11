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

// Allowed alias regex: alphanumeric, underscores, hyphens; 3 to 20 characters
const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export async function POST(request: Request) {
  try {
    let body: { email?: string; alias?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const rawAlias = body.alias?.trim() ?? "";

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!rawAlias) {
      return NextResponse.json({ error: "Alias name cannot be blank." }, { status: 400 });
    }

    if (!ALIAS_REGEX.test(rawAlias)) {
      return NextResponse.json(
        {
          error:
            "Alias must be 3-20 characters long and can only contain letters, numbers, underscores (_), and hyphens (-).",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Verify user exists
    const { data: user, error: userError } = await supabase
      .from("registrations")
      .select("id, email, alias_name, full_name")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "Attendee account not found." }, { status: 404 });
    }

    // 2. Check if the alias is already used by someone else (case-insensitive)
    const { data: duplicateUsers, error: dupError } = await supabase
      .from("registrations")
      .select("id, alias_name")
      .ilike("alias_name", rawAlias);

    if (dupError) {
      console.warn("Error checking alias duplication:", dupError);
    }

    const isTakenByOther = duplicateUsers?.some((u) => u.id !== user.id);
    if (isTakenByOther) {
      return NextResponse.json(
        { error: `The alias "${rawAlias}" is already taken. Please choose a different alias name.` },
        { status: 409 }
      );
    }

    // 3. Update the user's alias_name
    const { data: updated, error: updateError } = await supabase
      .from("registrations")
      .update({ alias_name: rawAlias })
      .eq("id", user.id)
      .select("id, email, alias_name, full_name")
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: `The alias "${rawAlias}" is already in use. Please select a unique alias.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: updateError.message || "Failed to update alias name." }, { status: 500 });
    }

    return NextResponse.json({
      message: "Alias name updated successfully!",
      alias: updated.alias_name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
