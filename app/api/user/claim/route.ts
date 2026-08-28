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
      .select("id, total_xp, checked_in, checked_in_at, promo_code")
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

    const isPromoQuest = quest_id.toLowerCase().includes("promo");
    if (isPromoQuest) {
      if (!user.promo_code || !user.promo_code.trim()) {
        return NextResponse.json(
          { error: "This quest is only available for attendees who registered using an official promo code or referral link." },
          { status: 400 }
        );
      }
    }

    let awardXp = Number(xp) || 100;

    // Check if dynamic quest requires admin review, passcode, or quiz validation
    if (quest_id !== "checkin" && quest_id !== "register") {
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
        quest_id,
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
    let logTitle = quest_id === "promo-bonus" ? "Media Partner: Promo Code Bonus" : (quest_id === "checkin" ? "Physical Gate Check-in" : "Event Quest Claim");
    let userMsg = user.promo_code ? `Claimed Promo Code Bonus (Code: ${user.promo_code})` : `Claimed quest reward: ${quest_id}`;

    try {
      await supabase.from("quest_verifications").insert({
        quest_id,
        quest_title: logTitle,
        user_name: user.id ? undefined : "Quester",
        user_email: user_email.trim().toLowerCase(),
        xp: awardXp,
        proof_url: "Auto-Verified (System Claim)",
        user_message: userMsg,
        status: "Approved",
        approved_by: "System",
        reviewed_at: new Date().toISOString(),
      });
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

    return NextResponse.json({ success: true, xp_awarded: awardXp, total_xp: calculatedTotalXp }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
