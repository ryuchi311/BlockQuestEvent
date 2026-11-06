import { SupabaseClient } from "@supabase/supabase-js";

export interface ComputeTotalXpOptions {
  completions?: Array<{ quest_id: string; xp_awarded?: number; created_at?: string; completed_at?: string }>;
  verifications?: Array<{ id?: any; quest_id: string; xp?: number; status?: string; user_message?: string | null; proof_url?: string | null; created_at?: string }>;
  messageNotes?: Array<{ id?: any; quest_id: string; xp?: number; status?: string; user_message?: string | null; proof_url?: string | null; created_at?: string }>;
}

export interface UserXpBreakdown {
  totalXp: number;
  compXp: number;
  verifXp: number;
}

/**
 * Accurately and consistently compute a user's total XP across completions and approved submissions.
 * Prevents duplicates between quest_completions and quest_verifications (including dated daily-claims and legacy claims).
 */
export function computeUserTotalXp({
  completions = [],
  verifications = [],
  messageNotes = [],
}: ComputeTotalXpOptions): UserXpBreakdown {
  // 1. Sum XP from quest_completions (authoritative records)
  const compXp = (completions || []).reduce((sum, c) => sum + (Number(c.xp_awarded) || 0), 0);

  // 2. Track completion keys for deduplication
  const compKeys = new Set<string>();
  (completions || []).forEach((c) => {
    const qId = (c.quest_id || "").trim();
    if (!qId) return;
    compKeys.add(qId);
    if (qId.startsWith("daily-claim-")) {
      const datePart = qId.replace("daily-claim-", "");
      compKeys.add(`daily-claim_${datePart}`);
    }
  });

  // 3. Process approved verifications & message notes
  const approvedItems = [
    ...(verifications || []).filter((v) => v.status === "Approved"),
    ...(messageNotes || []).filter((m) => m.status === "Approved"),
  ];

  // Sort descending by created_at so the latest verification takes precedence if there are duplicates
  approvedItems.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const uniqueVerifsByQuest = new Map<string, typeof approvedItems[0]>();

  for (const item of approvedItems) {
    let qId = (item.quest_id || "").trim();

    // Handle historical claims mislabeled as "daily-claim"
    if (qId === "daily-claim" && item.user_message && item.user_message.startsWith("Claimed quest reward: ")) {
      qId = item.user_message.replace("Claimed quest reward: ", "").trim();
    }

    const isDailySpin = qId === "daily-claim" || qId.startsWith("daily-claim-");
    let mapKey = qId;
    if (isDailySpin) {
      const match = (item.proof_url || "").match(/Daily - (\d{4}-\d{2}-\d{2})/);
      const datePart = match ? match[1] : (item.created_at ? item.created_at.slice(0, 10) : "");
      mapKey = `daily-claim_${datePart}`;
    }

    // If this quest has already been credited in quest_completions, skip to avoid double counting
    if (compKeys.has(qId) || compKeys.has(mapKey)) {
      continue;
    }

    // Deduplicate multiple verifications for the same task
    if (!uniqueVerifsByQuest.has(mapKey)) {
      uniqueVerifsByQuest.set(mapKey, item);
    }
  }

  const verifXp = Array.from(uniqueVerifsByQuest.values()).reduce(
    (sum, v) => sum + (Number(v.xp) || 0),
    0
  );

  return {
    totalXp: compXp + verifXp,
    compXp,
    verifXp,
  };
}

/**
 * Fetch and recalculate total XP for a user directly against Supabase, and optionally sync to registrations table.
 */
export async function syncUserTotalXpInDatabase(
  supabase: SupabaseClient,
  userId: number | string,
  userEmail: string,
  persistToDb: boolean = true
): Promise<number> {
  const normEmail = userEmail.trim().toLowerCase();

  const [compRes, verifRes, msgRes] = await Promise.all([
    supabase.from("quest_completions").select("quest_id, xp_awarded, created_at, completed_at").eq("registration_id", userId),
    supabase.from("quest_verifications").select("id, quest_id, xp, status, user_message, proof_url, created_at").ilike("user_email", normEmail),
    supabase.from("quest_message_notes").select("id, quest_id, xp, status, user_message, created_at").ilike("user_email", normEmail),
  ]);

  const { totalXp } = computeUserTotalXp({
    completions: compRes.data || [],
    verifications: verifRes.data || [],
    messageNotes: msgRes.data || [],
  });

  if (persistToDb) {
    await supabase.from("registrations").update({ total_xp: totalXp }).eq("id", userId);
  }

  return totalXp;
}
