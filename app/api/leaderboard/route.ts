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

// In-memory fallback if the database isn't ready
let memoryLeaderboard = [
  { rank: 1, name: "CryptoKing", points: 8500, change: "up", accent: "var(--gold-light)" },
  { rank: 2, name: "NFT_Queen", points: 8250, change: "same" },
  { rank: 3, name: "Web3Dev", points: 7900, change: "up" },
  { rank: 4, name: "BlockMaster", points: 7600, change: "down" },
  { rank: 5, name: "MetaExplorer", points: 7200, change: "same" },
];

export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Fetch top 50 users ordered by total_xp descending
    const { data, error } = await supabase
      .from("registrations")
      .select("full_name, total_xp, email")
      .order("total_xp", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("Leaderboard fetch error:", error.message);
      throw error;
    }

    if (data && data.length > 0) {
      const formatted = data.map((user, index) => ({
        rank: index + 1,
        name: user.full_name || "Anonymous",
        points: user.total_xp || 0,
        email: user.email, // Include email to easily find the current user's rank
        change: index === 0 ? "up" : "same", // Simplified change indicator
        accent: index === 0 ? "var(--gold-light)" : undefined,
      }));
      return NextResponse.json({ leaderboard: formatted });
    } else {
      return NextResponse.json({ leaderboard: memoryLeaderboard });
    }
  } catch (err) {
    return NextResponse.json({ leaderboard: memoryLeaderboard });
  }
}
