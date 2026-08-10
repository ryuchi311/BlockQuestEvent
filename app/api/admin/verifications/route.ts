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
let memoryVerifications: any[] = [
  {
    id: 1,
    quest_id: "follow-x",
    quest_title: "Follow @BlockQuest on X",
    user_name: "Jasper Cruz",
    user_email: "jasper@example.com",
    ticket_code: "BQF-7K9A2M",
    xp: 100,
    proof_url: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=500&auto=format&fit=crop&q=60",
    status: "Pending",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    quest_id: "join-tg",
    quest_title: "Join BlockQuest PH Telegram",
    user_name: "Mika Santos",
    user_email: "mika@example.com",
    ticket_code: "BQF-4L8X9P",
    xp: 100,
    proof_url: "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=500&auto=format&fit=crop&q=60",
    status: "Pending",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

// GET — fetch all verifications or filter by user email
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    const supabase = getSupabase();
    let query = supabase.from("quest_verifications").select("*").order("created_at", { ascending: false });

    if (email) {
      query = query.ilike("user_email", email);
    }

    const { data, error } = await query;

    if (error || !data) {
      const filtered = email
        ? memoryVerifications.filter((v) => v.user_email?.toLowerCase() === email)
        : memoryVerifications;
      return NextResponse.json({ verifications: filtered });
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

      if (!error && data) {
        return NextResponse.json({ verification: data }, { status: 201 });
      }
    } catch {
      // Fallback to memory
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
      const { data, error } = await supabase
        .from("quest_verifications")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ verification: data });
      }
    } catch {
      // Fallback
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
