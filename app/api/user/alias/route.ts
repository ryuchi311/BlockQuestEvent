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

    // 4. Automatically grant the "Add an Alias Name" quest (+50 XP) if not claimed yet
    let xpAwarded = 0;
    try {
      const { data: existingComp } = await supabase
        .from("quest_completions")
        .select("id")
        .eq("quest_id", "add-alias")
        .eq("registration_id", user.id)
        .maybeSingle();

      if (!existingComp) {
        await supabase.from("quest_completions").insert({
          quest_id: "add-alias",
          registration_id: user.id,
          xp_awarded: 50,
        });

        await supabase.from("quest_verifications").insert({
          quest_id: "add-alias",
          quest_title: "Profile: Add an Alias Name",
          user_name: user.full_name || undefined,
          user_email: email,
          xp: 50,
          proof_url: "Auto-Verified (Alias Active)",
          user_message: `Created alias name @${rawAlias}`,
          status: "Approved",
          approved_by: "System",
          reviewed_at: new Date().toISOString(),
        });

        // Recalculate total XP
        const { data: allComps } = await supabase
          .from("quest_completions")
          .select("xp_awarded")
          .eq("registration_id", user.id);

        const { data: allVerifs } = await supabase
          .from("quest_verifications")
          .select("xp, quest_id")
          .eq("user_email", email)
          .eq("status", "Approved");

        const compIds = new Set((allComps || []).map((c: any) => c.quest_id));
        const cXp = (allComps || []).reduce((sum: number, c: any) => sum + (c.xp_awarded || 0), 0);
        const vXp = (allVerifs || [])
          .filter((v: any) => !compIds.has(v.quest_id))
          .reduce((sum: number, v: any) => sum + (v.xp || 0), 0);

        const totalXp = cXp + vXp;
        await supabase.from("registrations").update({ total_xp: totalXp }).eq("id", user.id);
        xpAwarded = 50;
      }
    } catch (claimErr) {
      console.warn("Could not auto-grant add-alias quest:", claimErr);
    }

    return NextResponse.json({
      message: xpAwarded > 0 ? "Alias name updated successfully! +50 XP awarded!" : "Alias name updated successfully!",
      alias: updated.alias_name,
      xpAwarded,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
