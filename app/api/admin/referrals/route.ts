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

// GET - aggregate referral network data for Admin Monitoring
export async function GET(request: Request) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const supabase = getSupabase();

    // 1. Fetch top referrers (registrations with referral_count > 0)
    let { data: referrers, error: refErr } = await supabase
      .from("registrations")
      .select("id, full_name, alias_name, email, phone, ticket_code, referral_count, total_xp, created_at")
      .gt("referral_count", 0)
      .order("referral_count", { ascending: false });

    // Fallback if referral_count does not exist yet
    if (refErr && refErr.message?.includes("referral_count")) {
      referrers = [];
    } else if (refErr) {
      throw refErr;
    }

    // 2. Fetch all invitee registrations that used a referred_by_code
    let { data: invitees, error: invErr } = await supabase
      .from("registrations")
      .select("id, full_name, alias_name, email, ticket_code, referred_by_code, created_at, checked_in")
      .not("referred_by_code", "is", null)
      .order("created_at", { ascending: false });

    if (invErr && invErr.message?.includes("referred_by_code")) {
      invitees = [];
    } else if (invErr) {
      throw invErr;
    }

    // 3. Fetch automated referral quest logs from quest_verifications
    const { data: referralLogs } = await supabase
      .from("quest_verifications")
      .select("id, user_email, user_name, user_message, xp, reviewed_at, created_at")
      .eq("quest_id", "referral-quest")
      .order("created_at", { ascending: false })
      .limit(200);

    // Calculate Summary Metrics
    const totalReferrals = (invitees || []).length || (referrers || []).reduce((acc: number, r: any) => acc + (r.referral_count || 0), 0);
    const totalReferrers = (referrers || []).length;
    const maxCappedReferrers = (referrers || []).filter((r: any) => (r.referral_count || 0) >= 5).length;
    const totalReferralXpAwarded = (referrers || []).reduce((acc: number, r: any) => acc + Math.min(r.referral_count || 0, 5) * 100, 0);

    return NextResponse.json({
      metrics: {
        totalReferrals,
        totalReferrers,
        maxCappedReferrers,
        totalReferralXpAwarded,
      },
      referrers: referrers || [],
      invitees: invitees || [],
      referralLogs: referralLogs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
