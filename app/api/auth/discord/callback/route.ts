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

    // 3. Fetch User Profile and User Guilds from Discord API
    const [profileRes, guildsResponse] = await Promise.all([
      fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
    ]);

    const discordProfile = await profileRes.json();
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
      .select("id, full_name, ticket_code, total_xp")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.redirect(`${gameRedirectUrl}?error=user_not_found`);
    }

    // Fetch quest awarded XP & title
    const { data: quest } = await supabase
      .from("fiesta_event_quests")
      .select("title, xp")
      .eq("id", questId)
      .maybeSingle();

    const xpAmount = quest?.xp || 100;
    const questTitle = quest?.title || "Join Discord Server";

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

    // Log to quest_verifications table as 'Approved' so it displays in Quest Logs & Admin panel
    const discordUserId = discordProfile?.id;
    const discordUsername = discordProfile?.username || "Quester";
    const userMention = discordUserId ? `<@${discordUserId}>` : `@${discordUsername}`;

    await supabase.from("quest_verifications").insert({
      quest_id: questId,
      quest_title: questTitle,
      user_name: user.full_name || "Quester",
      user_email: email.trim().toLowerCase(),
      ticket_code: user.ticket_code || null,
      xp: xpAmount,
      proof_url: "Auto-Verified (Discord OAuth)",
      user_message: `Verified Discord User: ${userMention} (@${discordUsername})`,
      status: "Approved",
      approved_by: "System (Discord OAuth)",
      reviewed_at: new Date().toISOString(),
    });

    // Calculate total updated XP
    const { data: compList } = await supabase
      .from("quest_completions")
      .select("quest_id, xp_awarded")
      .eq("registration_id", user.id);

    const { data: verifList } = await supabase
      .from("quest_verifications")
      .select("quest_id, xp")
      .eq("user_email", email.trim().toLowerCase())
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

    // 6. Send Discord Announcement Message
    const announcementMessage = `🚀 **Discord Quest Complete!** ${userMention} (@${discordUsername}) has verified their Discord membership and unlocked **+${xpAmount} XP**! ⚡`;

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    try {
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: announcementMessage }),
        });
      } else if (botToken && channelId) {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: announcementMessage }),
        });
      }
    } catch (msgErr) {
      console.error("Failed to post Discord channel notification:", msgErr);
    }

    return NextResponse.redirect(`${gameRedirectUrl}?status=discord_claimed&xp=${xpAmount}&total_xp=${calculatedTotalXp}`);
  } catch (err) {
    console.error("Discord Auth Callback Error:", err);
    return NextResponse.redirect(`${gameRedirectUrl}?error=server_error`);
  }
}
