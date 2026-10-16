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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, user_email, xp, answer, passcode } = body;

    if (!quest_id || !user_email) {
      return NextResponse.json({ error: "quest_id and user_email are required." }, { status: 400 });
    }

    const supabase = getSupabase();
    
    // 1. Fetch current user to get ID and physical check-in status
    const { data: user, error: userError } = await supabase
      .from("registrations")
      .select("id, full_name, total_xp, checked_in, checked_in_at, promo_code, alias_name, ticket_code")
      .eq("email", user_email.trim().toLowerCase())
      .single();
      
    if (userError || !user) {
      return NextResponse.json({ error: "User registration not found." }, { status: 404 });
    }

    // If claiming physical check-in quest, verify gate check-in status
    if (quest_id === "checkin") {
      const isCheckedIn = user.checked_in || !!user.checked_in_at;
      if (!isCheckedIn) {
        return NextResponse.json(
          { error: "Physical check-in required at entrance gate before claiming this XP reward." },
          { status: 400 }
        );
      }
    }

    // If claiming add-alias quest, verify user has configured an alias name
    if (quest_id === "add-alias") {
      if (!user.alias_name || !user.alias_name.trim()) {
        return NextResponse.json(
          { error: "Please set your alias name first before claiming this reward! You can set an alias from the Profile tab or Leaderboard banner." },
          { status: 400 }
        );
      }
    }

    // Referral quest is credited automatically upon friend registration
    if (quest_id === "referral-quest") {
      return NextResponse.json(
        { error: "Referral XP is automatically awarded directly to your account whenever a friend registers using your link (up to 5 friends max)." },
        { status: 400 }
      );
    }

    const isPromoQuest = quest_id.toLowerCase().includes("promo");
    if (isPromoQuest) {
      if (!user.promo_code || !user.promo_code.trim()) {
        return NextResponse.json(
          { error: "This quest is only available for attendees who registered using an official promo code or referral link." },
          { status: 400 }
        );
      }
    }

    let isDailyClaim = quest_id === "daily-claim" || quest_id.startsWith("daily-claim-");
    let dailyClaimDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let effectiveQuestId = quest_id;

    if (isDailyClaim) {
      effectiveQuestId = `daily-claim-${dailyClaimDate}`;
      // Verify if user has already spun the wheel today
      const { data: existingDaily } = await supabase
        .from("quest_completions")
        .select("id, created_at")
        .eq("registration_id", user.id)
        .eq("quest_id", effectiveQuestId)
        .maybeSingle();

      if (existingDaily) {
        return NextResponse.json(
          { error: "You have already spun the Daily Wheel today! Come back tomorrow for another spin." },
          { status: 400 }
        );
      }
    }

    // Server-side wheel segments configuration (matches client WHEEL_SEGMENTS)
    const SERVER_WHEEL_SEGMENTS = [
      { xp: 0, label: "BOKYA", weight: 25, tier: "Bokya" },
      { xp: 5, label: "5", weight: 22, tier: "Common" },
      { xp: 10, label: "10", weight: 18, tier: "Uncommon" },
      { xp: 20, label: "20", weight: 12, tier: "Rare" },
      { xp: 5, label: "5", weight: 10, tier: "Common" },
      { xp: 0, label: "BOKYA", weight: 5, tier: "Bokya" },
      { xp: 30, label: "30", weight: 4.5, tier: "Epic" },
      { xp: 50, label: "50", weight: 2, tier: "Legendary" },
      { xp: 10, label: "10", weight: 1, tier: "Uncommon" },
      { xp: 100, label: "100", weight: 0.5, tier: "Jackpot" },
    ];

    let serverSegmentIndex = 0;
    let awardXp = quest_id === "add-alias" ? 50 : (Number(xp) || 100);

    // If it's a daily spin claim, the server ALWAYS determines the winning segment using weighted randomness
    // to strictly prevent client-side spoofing / DevTools tampering.
    if (isDailyClaim) {
      const totalWeight = SERVER_WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
      const rand = Math.random() * totalWeight;
      let accumulated = 0;
      for (let i = 0; i < SERVER_WHEEL_SEGMENTS.length; i++) {
        accumulated += SERVER_WHEEL_SEGMENTS[i].weight;
        if (rand <= accumulated) {
          serverSegmentIndex = i;
          break;
        }
      }
      awardXp = SERVER_WHEEL_SEGMENTS[serverSegmentIndex].xp;
    }

    // Check if dynamic quest requires admin review, passcode, or quiz validation
    if (quest_id !== "checkin" && quest_id !== "register" && !isDailyClaim) {
      const { data: quest, error: questError } = await supabase
        .from("fiesta_event_quests")
        .select("id, title, xp, status, requires_proof, requires_message, is_quiz, quiz_answer, passcode")
        .eq("id", quest_id)
        .maybeSingle();

      if (questError) {
        console.warn("Could not find quest:", questError);
      } else if (quest) {
        if (quest.xp !== undefined && quest.xp !== null) {
          awardXp = Number(quest.xp);
        }

        if (quest.requires_proof || quest.requires_message) {
          return NextResponse.json(
            { error: "This quest requires admin review before XP can be awarded. Please submit your verification for admin approval." },
            { status: 400 }
          );
        }

        // Server-side Passcode Verification
        if (quest.passcode) {
          const providedPasscode = (passcode || "").trim().toUpperCase();
          const expectedPasscode = quest.passcode.trim().toUpperCase();
          if (!providedPasscode || providedPasscode !== expectedPasscode) {
            return NextResponse.json(
              { error: "Incorrect secret passcode. Please check the code and try again." },
              { status: 400 }
            );
          }
        }

        // Server-side Quiz Answer Verification
        if (quest.is_quiz) {
          if (!answer) {
            return NextResponse.json({ error: "This is a quiz quest. Please provide an answer." }, { status: 400 });
          }
          if (!quest.quiz_answer || answer.trim().toLowerCase() !== quest.quiz_answer.trim().toLowerCase()) {
            return NextResponse.json({ error: "Incorrect answer. Try again!" }, { status: 400 });
          }
        }
      }
    }

    // 2. Insert into quest_completions
    const { error: completionError } = await supabase
      .from("quest_completions")
      .insert({
        quest_id: effectiveQuestId,
        registration_id: user.id,
        xp_awarded: awardXp
      });

    if (completionError) {
      if (completionError.code === '23505') {
        // Already claimed - do not add XP again!
        return NextResponse.json({ success: true, already_claimed: true }, { status: 200 });
      }
      return NextResponse.json({ error: completionError.message }, { status: 500 });
    }

    // 3. Log to quest_verifications table as 'Approved' so it displays in Quest Logs & Admin panel
    let logTitle =
      isDailyClaim
        ? "Daily Wheel of Luck"
        : quest_id === "promo-bonus"
        ? "Media Partner: Promo Code Bonus"
        : quest_id === "checkin"
        ? "Physical Gate Check-in"
        : quest_id === "add-alias"
        ? "Profile: Add an Alias Name"
        : "Event Quest Claim";

    let userMsg =
      isDailyClaim
        ? awardXp === 0
          ? "Spun the Peryahan Wheel of Luck and got Bokya! (0 XP)"
          : `Spun the Peryahan Wheel of Luck and won +${awardXp} XP!`
        : quest_id === "add-alias" && user.alias_name
        ? `Added alias name @${user.alias_name}`
        : user.promo_code
        ? `Claimed Promo Code Bonus (Code: ${user.promo_code})`
        : `Claimed quest reward: ${quest_id}`;

    const questerName = user.alias_name ? `@${user.alias_name}` : (user.full_name || "Registered Quester");

    try {
      const { error: verifInsertErr } = await supabase.from("quest_verifications").insert({
        quest_id: "daily-claim",
        quest_title: logTitle,
        user_name: questerName,
        user_email: user_email.trim().toLowerCase(),
        ticket_code: user.ticket_code || undefined,
        xp: awardXp,
        proof_url: isDailyClaim ? `Wheel of Luck Spin (Daily - ${new Date().toISOString().slice(0, 10)})` : "Auto-Verified (System Claim)",
        user_message: userMsg,
        status: "Approved",
        approved_by: "System",
        reviewed_at: new Date().toISOString(),
      });
      if (verifInsertErr) {
        console.warn("quest_verifications insert error:", verifInsertErr);
      }
    } catch (verifErr) {
      console.warn("Could not log to quest_verifications:", verifErr);
    }

    // 4. Calculate exact total XP from quest_completions + approved quest_verifications
    const { data: compList } = await supabase
      .from("quest_completions")
      .select("quest_id, xp_awarded")
      .eq("registration_id", user.id);

    const { data: verifList } = await supabase
      .from("quest_verifications")
      .select("quest_id, xp")
      .eq("user_email", user_email.trim().toLowerCase())
      .eq("status", "Approved");

    const compQuestIds = new Set((compList || []).map((c: any) => c.quest_id));
    const compXp = (compList || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
    const verifXp = (verifList || [])
      .filter((v: any) => !compQuestIds.has(v.quest_id))
      .reduce((sum, v) => sum + (v.xp || 0), 0);
    const calculatedTotalXp = compXp + verifXp;

    await supabase
      .from("registrations")
      .update({ total_xp: calculatedTotalXp })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      xp_awarded: awardXp,
      segment_index: isDailyClaim ? serverSegmentIndex : undefined,
      tier: isDailyClaim ? SERVER_WHEEL_SEGMENTS[serverSegmentIndex].tier : undefined,
      label: isDailyClaim ? SERVER_WHEEL_SEGMENTS[serverSegmentIndex].label : undefined,
      total_xp: calculatedTotalXp
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
