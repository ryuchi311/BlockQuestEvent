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

const QUEST_TITLES: Record<string, string> = {
  "register": "Register for BlockQuest Fiesta PH",
  "checkin": "Complete physical check-in",
  "follow-x": "Follow @BlockQuest on X",
  "join-tg": "Join BlockQuest PH Telegram",
  "daily-claim": "Daily Check-in"
};

// GET — fetch all verifications (Admin queue requires auth, public ?email= filter for quester status)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    // If fetching global queue without user email, require verifier/admin auth
    if (!email) {
      const auth = verifyAdminAuth(request, ["superadmin", "admin", "verifier"]);
      if (!auth.authorized) {
        return unauthorizedResponse(auth.error, auth.status);
      }
    }

    const supabase = getSupabase();

    if (email) {
      // Fetch screenshot verifications from Supabase
      const { data: verifs } = await supabase
        .from("quest_verifications")
        .select("*")
        .ilike("user_email", email);

      // Fetch user ID to get instant completions
      const { data: user } = await supabase
        .from("registrations")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      let completions: any[] = [];
      if (user) {
        const { data: compData } = await supabase
          .from("quest_completions")
          .select("*")
          .eq("registration_id", user.id);
        completions = compData || [];
      }

      // Fetch all dynamic quest titles from database for accurate names
      const { data: allQuests } = await supabase
        .from("fiesta_event_quests")
        .select("id, title");
      
      const dynamicTitles: Record<string, string> = { ...QUEST_TITLES };
      (allQuests || []).forEach((q: any) => {
        if (q.id && q.title) dynamicTitles[q.id] = q.title;
      });

      // Map instant claims into activity log entries
      const formattedCompletions = completions.map((c: any) => ({
        id: `comp_${c.id}`,
        quest_id: c.quest_id,
        quest_title: dynamicTitles[c.quest_id] || c.quest_id,
        user_email: email,
        xp: c.xp_awarded,
        status: "Approved",
        created_at: c.completed_at || c.created_at || new Date().toISOString(),
        is_instant: true,
      }));

      const combined = [...(verifs || []), ...formattedCompletions].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return NextResponse.json({ verifications: combined });
    }

    // Admin view: fetch strictly from quest_verifications table (DESC - newest first)
    const { data, error } = await supabase
      .from("quest_verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ verifications: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — user submits proof screenshot or text message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, quest_title, user_name, user_email, ticket_code, xp, proof_url, user_message } = body;

    if (!quest_id || (!proof_url && !user_message)) {
      return NextResponse.json({ error: "quest_id and proof_url or user_message are required." }, { status: 400 });
    }

    let finalProofUrl = proof_url || "Text Submission";

    // Upload Base64 image to Supabase Storage bucket if provided
    if (proof_url && proof_url.startsWith("data:image/")) {
      try {
        const supabase = getSupabase();
        const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "blockquestbucket";
        const matches = proof_url.match(/^data:(image\/\w+);base64,(.+)$/);

        if (matches) {
          const contentType = matches[1];
          const ext = contentType.split("/")[1] || "png";
          const buffer = Buffer.from(matches[2], "base64");
          const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

          const { data: storageData, error: storageError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, buffer, {
              contentType,
              upsert: true,
            });

          if (!storageError && storageData) {
            const { data: publicUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(fileName);

            if (publicUrlData?.publicUrl) {
              finalProofUrl = publicUrlData.publicUrl;
            }
          }
        }
      } catch (storageErr) {
        console.warn("Supabase Storage upload warning:", storageErr);
      }
    }

    const newRecord = {
      id: Date.now(),
      quest_id,
      quest_title: quest_title || "Quest Verification",
      user_name: user_name || "Anonymous Quester",
      user_email: user_email || "user@blockquest.ph",
      ticket_code: ticket_code || "BQF-GUEST",
      xp: Number(xp) || 100,
      proof_url: finalProofUrl,
      user_message: user_message || null,
      status: "Pending",
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabase();

      // Check for existing record to reuse / update (prevents DB unique constraint errors)
      const { data: existingRecords } = await supabase
        .from("quest_verifications")
        .select("id")
        .eq("quest_id", quest_id)
        .ilike("user_email", newRecord.user_email)
        .order("created_at", { ascending: false })
        .limit(1);

      let data, error;
      if (existingRecords && existingRecords.length > 0) {
        const res = await supabase
          .from("quest_verifications")
          .update({
            proof_url: finalProofUrl,
            user_message: user_message || null,
            status: "Pending",
            rejection_reason: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingRecords[0].id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from("quest_verifications")
          .insert({
            quest_id,
            quest_title: newRecord.quest_title,
            user_name: newRecord.user_name,
            user_email: newRecord.user_email,
            ticket_code: newRecord.ticket_code,
            xp: newRecord.xp,
            proof_url: finalProofUrl,
            user_message: user_message || null,
            status: "Pending",
          })
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("quest_verifications insert error:", error);
        return NextResponse.json({ error: error.message || "Database insert failed" }, { status: 500 });
      } else if (data) {
        return NextResponse.json({ verification: data }, { status: 201 });
      }
    } catch (err: any) {
      console.error("Database connection error:", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a submission (with optional rejection reason & admin attribution)
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "verifier"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { id, status, rejection_reason, approved_by, admin_email } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const reviewer = approved_by || admin_email || auth.user?.fullName || "Admin";
    const updatePayload: Record<string, any> = {
      status,
      approved_by: reviewer,
      reviewed_at: new Date().toISOString(),
    };
    if (rejection_reason !== undefined) {
      updatePayload.rejection_reason = rejection_reason;
    }

    const supabase = getSupabase();

    // 1. Fetch current verification to know the XP and User
    const { data: currentVerif, error: fetchErr } = await supabase
      .from("quest_verifications")
      .select("user_email, xp, status, quest_id")
      .eq("id", id)
      .single();

    if (fetchErr || !currentVerif) {
      return NextResponse.json({ error: "Verification record not found." }, { status: 404 });
    }

    if (currentVerif.status === status) {
      return NextResponse.json({ verification: currentVerif });
    }

    // 2. Update the verification status
    const { data, error } = await supabase
      .from("quest_verifications")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Update failed" }, { status: 500 });
    }

    // 3. If transitioning to Approved, award XP & record completion in database
    if (status === "Approved" && currentVerif) {
      const { data: user } = await supabase
        .from("registrations")
        .select("id, total_xp")
        .eq("email", currentVerif.user_email)
        .single();

      if (user) {
        // Only increment XP if it was not already Approved
        if (currentVerif.status !== "Approved") {
          await supabase
            .from("registrations")
            .update({ total_xp: (user.total_xp || 0) + (currentVerif.xp || 0) })
            .eq("id", user.id);
        }

        // Ensure record is inserted into quest_completions DB table
        const { error: compErr } = await supabase
          .from("quest_completions")
          .insert({
            quest_id: currentVerif.quest_id,
            registration_id: user.id,
            user_email: currentVerif.user_email,
            xp_awarded: currentVerif.xp
          });

        if (compErr && compErr.code !== "23505") {
          console.warn("quest_completions insert notice:", compErr.message);
        }
      }
    } else if ((status === "Rejected" || status === "Pending") && currentVerif && currentVerif.status === "Approved") {
      // If revoked from Approved -> Rejected/Pending, deduct XP & remove completion
      const { data: user } = await supabase
        .from("registrations")
        .select("id, total_xp")
        .eq("email", currentVerif.user_email)
        .single();

      if (user) {
        await supabase
          .from("registrations")
          .update({ total_xp: Math.max(0, (user.total_xp || 0) - (currentVerif.xp || 0)) })
          .eq("id", user.id);

        await supabase
          .from("quest_completions")
          .delete()
          .eq("quest_id", currentVerif.quest_id)
          .eq("registration_id", user.id);
      }
    }

    return NextResponse.json({ verification: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
