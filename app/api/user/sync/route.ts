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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 1. Fetch user from registrations
    const { data: user } = await supabase
      .from("registrations")
      .select("id, total_xp, checked_in, checked_in_at")
      .ilike("email", email)
      .maybeSingle();

    let completions: string[] = [];
    let verifications: any[] = [];
    let compXp = 0;
    let verifXp = 0;

    let isCheckedIn = false;

    if (user) {
      isCheckedIn = user.checked_in || !!user.checked_in_at;
      // 2. Fetch completed instant quests
      const { data: compData } = await supabase
        .from("quest_completions")
        .select("quest_id, xp_awarded")
        .eq("registration_id", user.id);

      if (compData) {
        completions = compData.map((c) => c.quest_id);
        compXp = compData.reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
      }
    }

    // 3. Fetch quest verifications & message notes
    const [verifRes, msgRes] = await Promise.all([
      supabase
        .from("quest_verifications")
        .select("id, quest_id, status, xp, rejection_reason, user_message, created_at")
        .ilike("user_email", email)
        .order("created_at", { ascending: false }),
      supabase
        .from("quest_message_notes")
        .select("id, quest_id, status, xp, rejection_reason, user_message, created_at")
        .ilike("user_email", email)
        .order("created_at", { ascending: false })
    ]);

    const combinedVerifs = [
      ...(verifRes.data || []),
      ...(msgRes.data || [])
    ];

    verifications = combinedVerifs;
    verifXp = combinedVerifs
      .filter((v) => v.status === "Approved")
      .reduce((sum, v) => sum + (v.xp || 0), 0);

    const exactTotalXp = compXp + verifXp;

    // Sync registrations table if total_xp is out of sync
    if (user && user.total_xp !== exactTotalXp) {
      await supabase
        .from("registrations")
        .update({ total_xp: exactTotalXp })
        .eq("id", user.id);
    }

    return NextResponse.json({
      totalXp: exactTotalXp,
      completedQuests: completions,
      verifications: verifications,
      isCheckedIn: isCheckedIn,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
