import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get("email");
  const questId = searchParams.get("quest_id") || "discord_member";

  if (!userEmail) {
    return NextResponse.json({ error: "Missing user email parameter." }, { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Discord OAuth is not configured. Missing DISCORD_CLIENT_ID on server." },
      { status: 500 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = encodeURIComponent(`${origin}/api/auth/discord/callback`);
  
  // Encode state to preserve the claiming user's email and quest id
  const state = encodeURIComponent(JSON.stringify({ email: userEmail, quest_id: questId }));

  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=identify%20guilds&state=${state}`;

  return NextResponse.redirect(discordAuthUrl);
}
