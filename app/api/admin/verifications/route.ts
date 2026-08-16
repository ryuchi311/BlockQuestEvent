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
let memoryVerifications: any[] = [];

const QUEST_TITLES: Record<string, string> = {
  "register": "Register for BlockQuest Fiesta PH",
  "checkin": "Complete physical check-in",
  "follow-x": "Follow @BlockQuest on X",
  "join-tg": "Join BlockQuest PH Telegram",
  "daily-claim": "Daily Check-in"
};

// GET — fetch all verifications or filter by user email
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

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

      // Map instant claims into activity log entries
      const formattedCompletions = completions.map((c: any) => ({
        id: `comp_${c.id}`,
        quest_id: c.quest_id,
        quest_title: QUEST_TITLES[c.quest_id] || c.quest_id,
        user_email: email,
        xp: c.xp_awarded,
        status: "Approved",
        created_at: c.created_at,
        is_instant: true,
      }));

      const combined = [...(verifs || []), ...formattedCompletions].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return NextResponse.json({ verifications: combined });
    }

    // Admin view: fetch all proof verifications
    const { data, error } = await supabase
      .from("quest_verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return NextResponse.json({ verifications: memoryVerifications });
    }
    return NextResponse.json({ verifications: data });
  } catch {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const filtered = email
      ? memoryVerifications.filter((v) => v.user_email?.toLowerCase() === email)
      : memoryVerifications;
    return NextResponse.json({ verifications: filtered });
  }
}

// POST — user submits proof screenshot
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quest_id, quest_title, user_name, user_email, ticket_code, xp, proof_url } = body;

    if (!quest_id || !proof_url) {
      return NextResponse.json({ error: "quest_id and proof_url are required." }, { status: 400 });
    }

    let finalProofUrl = proof_url;

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
      status: "Pending",
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("quest_verifications")
        .insert({
          quest_id,
          quest_title: newRecord.quest_title,
          user_name: newRecord.user_name,
          user_email: newRecord.user_email,
          ticket_code: newRecord.ticket_code,
          xp: newRecord.xp,
          proof_url: finalProofUrl,
          status: "Pending",
        })
        .select()
        .single();

      if (error) {
        console.warn("quest_verifications insert error:", error);
      } else if (data) {
        return NextResponse.json({ verification: data }, { status: 201 });
      }
    } catch (err: any) {
      console.warn("Falling back to in-memory verifications. DB Error:", err.message);
    }

    memoryVerifications.unshift(newRecord);
    return NextResponse.json({ verification: newRecord }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — admin approves or rejects a submission (with optional rejection reason)
export async function PATCH(request: Request) {
  try {
    const { id, status, rejection_reason } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const updatePayload: Record<string, any> = { status };
    if (rejection_reason !== undefined) {
      updatePayload.rejection_reason = rejection_reason;
    }

    try {
      const supabase = getSupabase();
      
      // 1. Fetch current verification to know the XP and User
      const { data: currentVerif } = await supabase
        .from("quest_verifications")
        .select("user_email, xp, status, quest_id")
        .eq("id", id)
        .single();
        
      if (currentVerif && currentVerif.status !== "Pending") {
        return NextResponse.json({ error: `Verification has already been processed by another admin (Status: ${currentVerif.status}).` }, { status: 409 });
      }
        
      // 2. Update the verification status
      const { data, error } = await supabase
        .from("quest_verifications")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        // 3. If just approved, award the XP to the user in registrations
        if (status === "Approved" && currentVerif && currentVerif.status !== "Approved") {
          const { data: user } = await supabase
            .from("registrations")
            .select("id, total_xp")
            .eq("email", currentVerif.user_email)
            .single();
            
          if (user) {
            await supabase
              .from("registrations")
              .update({ total_xp: (user.total_xp || 0) + (currentVerif.xp || 0) })
              .eq("id", user.id);
              
            // Also insert into quest_completions to mark it done
            await supabase
              .from("quest_completions")
              .insert({
                quest_id: currentVerif.quest_id,
                registration_id: user.id,
                xp_awarded: currentVerif.xp
              });
          }
        }
        return NextResponse.json({ verification: data });
      }
    } catch {
      // Fallback
    }

    const existingMemoryItem = memoryVerifications.find((item) => item.id === id);
    if (existingMemoryItem && existingMemoryItem.status !== "Pending") {
      return NextResponse.json({ error: `Verification has already been processed by another admin (Status: ${existingMemoryItem.status}).` }, { status: 409 });
    }

    memoryVerifications = memoryVerifications.map((item) =>
      item.id === id ? { ...item, status, rejection_reason: rejection_reason || null } : item
    );
    const updatedItem = memoryVerifications.find((item) => item.id === id);
    return NextResponse.json({ verification: updatedItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
