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
      .select("id, full_name, alias_name, total_xp, checked_in, checked_in_at, promo_code, ticket_code, referral_count")
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
      // 2. Fetch completed instant quests by registration_id
      const { data: compData } = await supabase
        .from("quest_completions")
        .select("*")
        .eq("registration_id", user.id);

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
          const { data: inserted, error: insErr } = await supabase
            .from("quest_completions")
            .upsert(newComp, { onConflict: "quest_id,registration_id", ignoreDuplicates: true })
            .select()
            .maybeSingle();

          if (inserted) {
            list = [...list, inserted];
          } else {
            list = [...list, { ...newComp, created_at: new Date().toISOString() }];
          }
        } catch {
          list = [...list, { quest_id: "register", xp_awarded: 250, created_at: new Date().toISOString() }];
        }
      }

      // Auto-grant the 500 XP checkin quest if attendee has physically checked in at entrance gate
      const hasCheckin = list.some((c: any) => c.quest_id === "checkin");
      if (isCheckedIn && !hasCheckin) {
        try {
          const newCheckinComp: Record<string, any> = {
            quest_id: "checkin",
            xp_awarded: 500,
            registration_id: user.id,
          };
          const { data: insertedCheckin, error: checkinInsErr } = await supabase
            .from("quest_completions")
            .upsert(newCheckinComp, { onConflict: "quest_id,registration_id", ignoreDuplicates: true })
            .select()
            .maybeSingle();

          if (insertedCheckin) {
            list = [...list, insertedCheckin];
          } else {
            list = [...list, { ...newCheckinComp, created_at: new Date().toISOString() }];
          }

          // Also record in quest_verifications as Approved for Quest Logs
          await supabase.from("quest_verifications").insert({
            quest_id: "checkin",
            quest_title: "Physical Gate Check-in",
            user_name: user.full_name || undefined,
            user_email: email,
            xp: 500,
            proof_url: "Gate QR Scan Check-in",
            user_message: "Auto-claimed upon entrance gate check-in",
            status: "Approved",
            approved_by: "Gate System",
            reviewed_at: new Date().toISOString(),
          });
        } catch (checkinErr) {
          console.warn("Could not auto-insert checkin quest completion:", checkinErr);
          list = [...list, { quest_id: "checkin", xp_awarded: 500, created_at: new Date().toISOString() }];
        }
      }

      // Auto-grant the 50 XP add-alias quest if attendee has configured an alias name
      const hasAlias = Boolean(user.alias_name && user.alias_name.trim());
      const hasAliasComp = list.some((c: any) => c.quest_id === "add-alias");
      if (hasAlias && !hasAliasComp) {
        try {
          const newAliasComp: Record<string, any> = {
            quest_id: "add-alias",
            xp_awarded: 50,
            registration_id: user.id,
          };
          const { data: insertedAlias, error: aliasInsErr } = await supabase
            .from("quest_completions")
            .upsert(newAliasComp, { onConflict: "quest_id,registration_id", ignoreDuplicates: true })
            .select()
            .maybeSingle();

          if (insertedAlias) {
            list = [...list, insertedAlias];
          } else {
            list = [...list, { ...newAliasComp, created_at: new Date().toISOString() }];
          }

          // Also record in quest_verifications as Approved for Quest Logs
          await supabase.from("quest_verifications").insert({
            quest_id: "add-alias",
            quest_title: "Profile: Add an Alias Name",
            user_name: user.full_name || undefined,
            user_email: email,
            ticket_code: user.ticket_code || undefined,
            xp: 50,
            proof_url: "Auto-Verified (Alias Active)",
            user_message: `Created alias name @${user.alias_name}`,
            status: "Approved",
            approved_by: "System",
            reviewed_at: new Date().toISOString(),
          });
        } catch (aliasErr) {
          console.warn("Could not auto-insert alias quest completion:", aliasErr);
          list = [...list, { quest_id: "add-alias", xp_awarded: 50, created_at: new Date().toISOString() }];
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
    const compQuestIds = new Set(completions);
    verifications = verificationsList;
    verifXp = verificationsList
      .filter((v: any) => v.status === "Approved" && !compQuestIds.has(v.quest_id))
      .reduce((sum: number, v: any) => sum + (v.xp || 0), 0);

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
      aliasName: user?.alias_name || null,
      ticketCode: user?.ticket_code || null,
      referralCount: user?.referral_count || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
