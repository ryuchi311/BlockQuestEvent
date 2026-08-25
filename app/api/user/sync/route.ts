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
    const { data: user, error: userError } = await supabase
      .from("registrations")
      .select("id, total_xp, checked_in, checked_in_at, promo_code")
      .eq("email", email)
      .single();

    let completions: string[] = [];
    let completedDetails: any[] = [];
    let verifications: any[] = [];
    let compXp = 0;
    let verifXp = 0;

    let isCheckedIn = false;

    if (user) {
      isCheckedIn = user.checked_in || !!user.checked_in_at;
      // 2. Fetch completed instant quests (support both registration_id and user_email)
      const { data: compData } = await supabase
        .from("quest_completions")
        .select("*")
        .or(`registration_id.eq.${user.id},user_email.ilike.${email}`);

      let list = compData || [];
      const hasRegister = list.some((c: any) => c.quest_id === "register");

      // Auto-grant the 250 XP registration quest if missing for registered users
      if (!hasRegister) {
        try {
          const newComp: Record<string, any> = {
            quest_id: "register",
            xp_awarded: 250,
            registration_id: user.id,
          };
          const { data: inserted } = await supabase
            .from("quest_completions")
            .insert(newComp)
            .select()
            .single();

          if (inserted) {
            list = [...list, inserted];
          } else {
            list = [...list, { ...newComp, created_at: new Date().toISOString() }];
          }
        } catch {
          list = [...list, { quest_id: "register", xp_awarded: 250, created_at: new Date().toISOString() }];
        }
      }

      completions = list.map((c: any) => c.quest_id);
      completedDetails = list.map((c: any) => ({
        quest_id: c.quest_id,
        xp_awarded: c.xp_awarded || 0,
        completed_at: c.created_at || c.completed_at || new Date().toISOString(),
      }));
      compXp = list.reduce((sum: number, c: any) => sum + (c.xp_awarded || 0), 0);
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

    const sortedSubmissions = [
      ...(verifRes.data || []),
      ...(msgRes.data || [])
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const latestByQuestMap = new Map<string, any>();
    sortedSubmissions.forEach((item) => {
      if (!latestByQuestMap.has(item.quest_id)) {
        latestByQuestMap.set(item.quest_id, item);
      }
    });

    const verificationsList = Array.from(latestByQuestMap.values());

    verifications = verificationsList;
    verifXp = verificationsList
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
      completedQuestDetails: completedDetails,
      verifications: verifications,
      isCheckedIn: isCheckedIn,
      promoCode: user?.promo_code || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
