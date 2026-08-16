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

// In-memory fallback array for dev/demo when Supabase table isn't migrated yet
let memoryCompletions: any[] = [];
let memoryUsersXp: Record<string, number> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, user_email, xp, answer } = body;

    if (!quest_id || !user_email || xp === undefined) {
      return NextResponse.json({ error: "quest_id, user_email, and xp are required." }, { status: 400 });
    }

    try {
      const supabase = getSupabase();
      
      // 1. Fetch current user to get ID and physical check-in status
      const { data: user, error: userError } = await supabase
        .from("registrations")
        .select("id, total_xp, checked_in, checked_in_at")
        .eq("email", user_email)
        .single();
        
      if (userError || !user) {
        console.warn("Could not find user:", userError);
        throw new Error("User not found");
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

      // Check if quest requires admin review (requires_proof or requires_message) or is a quiz
      if (quest_id !== "checkin" && quest_id !== "register") {
        const { data: quest, error: questError } = await supabase
          .from("fiesta_event_quests")
          .select("requires_proof, requires_message, is_quiz, quiz_answer")
          .eq("id", quest_id)
          .single();

        if (questError) {
          console.warn("Could not find quest:", questError);
        } else {
          if (quest?.requires_proof || quest?.requires_message) {
            return NextResponse.json(
              { error: "This quest requires admin review before XP can be awarded. Please submit your verification for admin approval." },
              { status: 400 }
            );
          }

          if (quest?.is_quiz) {
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
          registration_id: user.id, // Using the correct column from existing schema
          xp_awarded: Number(xp)
        });

      if (completionError) {
        if (completionError.code === '23505') {
          // Already claimed - do not add XP again!
          return NextResponse.json({ success: true, already_claimed: true }, { status: 200 });
        }
        console.warn("quest_completions insert error:", completionError);
        throw completionError;
      }

      // 3. Calculate exact total XP from quest_completions + approved quest_verifications
      const { data: compList } = await supabase
        .from("quest_completions")
        .select("xp_awarded")
        .eq("registration_id", user.id);

      const { data: verifList } = await supabase
        .from("quest_verifications")
        .select("xp")
        .eq("user_email", user_email)
        .eq("status", "Approved");

      const compXp = (compList || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
      const verifXp = (verifList || []).reduce((sum, v) => sum + (v.xp || 0), 0);
      const calculatedTotalXp = compXp + verifXp;

      await supabase
        .from("registrations")
        .update({ total_xp: calculatedTotalXp })
        .eq("id", user.id);

      return NextResponse.json({ success: true, xp_awarded: xp, total_xp: calculatedTotalXp }, { status: 201 });
    } catch (err: any) {
      console.warn("Falling back to in-memory completions. DB Error:", err.message);
    }

    // Fallback to memory
    const existing = memoryCompletions.find(c => c.quest_id === quest_id && c.user_email === user_email);
    if (!existing) {
      memoryCompletions.push({ quest_id, user_email, xp_awarded: xp, created_at: new Date().toISOString() });
      memoryUsersXp[user_email] = (memoryUsersXp[user_email] || 0) + Number(xp);
    }

    return NextResponse.json({ success: true, xp_awarded: xp, fallback: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
