import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MISSIONS = [
  { id: 1, platform: "facebook", title: "Facebook Page", description: "Follow BRGY Tamago", url: "https://www.facebook.com/BRGYTamago", button_text: "Follow FB →", button_color: "#1877f2", sort_order: 1, is_active: true },
  { id: 2, platform: "telegram", title: "Telegram Channel", description: "Follow BlockQuest", url: "https://t.me/block_quest", button_text: "Join TG →", button_color: "#24A1DE", sort_order: 2, is_active: true },
  { id: 3, platform: "telegram", title: "Telegram Group", description: "Join BlockQuest Group", url: "https://t.me/+YG918_es6Es0Mjc1", button_text: "Join TG →", button_color: "#24A1DE", sort_order: 3, is_active: true },
  { id: 4, platform: "twitter", title: "X (Twitter)", description: "Follow @BRGYTamago", url: "https://x.com/BRGYTamago", button_text: "Follow X →", button_color: "#000000", sort_order: 4, is_active: true },
];

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// GET - fetch all social missions for the registration form (public)
export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ missions: DEFAULT_MISSIONS });
    }

    const { data, error } = await supabase
      .from("social_missions")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ missions: DEFAULT_MISSIONS });
    }

    // Filter out inactive / hidden missions (support legacy records where is_active is null)
    const activeMissions = data.filter((m: any) => m.is_active !== false);

    return NextResponse.json({
      missions: activeMissions.length > 0 ? activeMissions : DEFAULT_MISSIONS,
    });
  } catch (err: any) {
    console.error("Error fetching social missions:", err);
    return NextResponse.json({ missions: DEFAULT_MISSIONS });
  }
}

