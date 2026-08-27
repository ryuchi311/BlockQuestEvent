import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const gameRedirectUrl = `${origin}/zealy`;

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${gameRedirectUrl}?error=discord_auth_failed`);
  }

  let email = "";
  let questId = "discord_member";
  try {
    const parsedState = JSON.parse(decodeURIComponent(stateRaw));
    email = parsedState.email;
    questId = parsedState.quest_id || questId;
  } catch {
    return NextResponse.redirect(`${gameRedirectUrl}?error=invalid_state`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${gameRedirectUrl}?error=discord_config_missing`);
  }

  const supabase = getSupabase();

  // 1. Fetch Quest Details (XP & dynamic discord_guild_id stored in database)
  const { data: quest } = await supabase
    .from("fiesta_event_quests")
    .select("xp, discord_guild_id")
    .eq("id", questId)
    .maybeSingle();

  const targetGuildId = quest?.discord_guild_id || process.env.DISCORD_GUILD_ID;
  if (!targetGuildId) {
    console.error("Missing Discord Guild ID for quest:", questId);
    return NextResponse.redirect(`${gameRedirectUrl}?error=discord_guild_not_configured`);
  }

  const redirectUri = `${origin}/api/auth/discord/callback`;

  try {
    // 2. Exchange OAuth code for Access Token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Discord token exchange error:", tokenData);
      return NextResponse.redirect(`${gameRedirectUrl}?error=discord_token_error`);
    }

    // 3. Fetch User Guilds from Discord API
    const guildsResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userGuilds = await guildsResponse.json();
    if (!guildsResponse.ok || !Array.isArray(userGuilds)) {
      console.error("Discord guilds fetch error:", userGuilds);
      return NextResponse.redirect(`${gameRedirectUrl}?error=discord_guild_fetch_failed`);
    }

    // 4. Verify membership against the quest's specific Discord Guild ID
    const isMember = userGuilds.some((g: { id: string }) => g.id === targetGuildId);

    if (!isMember) {
      return NextResponse.redirect(`${gameRedirectUrl}?error=not_a_discord_member`);
    }

    // 5. Record XP and Quest Completion in Supabase
    const { data: user, error: userError } = await supabase
      .from("registrations")
      .select("id, total_xp")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.redirect(`${gameRedirectUrl}?error=user_not_found`);
    }

    // Fetch quest awarded XP
    const { data: quest } = await supabase
      .from("fiesta_event_quests")
      .select("xp")
      .eq("id", questId)
      .maybeSingle();

    const xpAmount = quest?.xp || 100;

    // Record quest completion
    const { error: completionError } = await supabase
      .from("quest_completions")
      .insert({
        quest_id: questId,
        registration_id: user.id,
        xp_awarded: xpAmount,
      });

    if (completionError) {
      if (completionError.code === "23505") {
        return NextResponse.redirect(`${gameRedirectUrl}?status=already_claimed`);
      }
      console.error("Completion DB insert error:", completionError);
      return NextResponse.redirect(`${gameRedirectUrl}?error=db_error`);
    }

    // Calculate total updated XP
    const { data: compList } = await supabase
      .from("quest_completions")
      .select("xp_awarded")
      .eq("registration_id", user.id);

    const { data: verifList } = await supabase
      .from("quest_verifications")
      .select("xp")
      .eq("user_email", email.trim().toLowerCase())
      .eq("status", "Approved");

    const compXp = (compList || []).reduce((sum, c) => sum + (c.xp_awarded || 0), 0);
    const verifXp = (verifList || []).reduce((sum, v) => sum + (v.xp || 0), 0);
    const calculatedTotalXp = compXp + verifXp;

    await supabase
      .from("registrations")
      .update({ total_xp: calculatedTotalXp })
      .eq("id", user.id);

    return NextResponse.redirect(`${gameRedirectUrl}?status=discord_claimed&xp=${xpAmount}&total_xp=${calculatedTotalXp}`);
  } catch (err) {
    console.error("Discord Auth Callback Error:", err);
    return NextResponse.redirect(`${gameRedirectUrl}?error=server_error`);
  }
}
