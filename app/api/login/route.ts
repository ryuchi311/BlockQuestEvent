import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyPassword } from "../../../utils/registration-password";
import { getClientIp, checkRateLimit } from "../../../utils/rate-limit";
import { computeUserTotalXp } from "../../../utils/xp";

export const runtime = "nodejs";

type LoginPayload = {
  email?: string;
  phone?: string;
  password?: string;
  pincode?: string;
  skipPin?: boolean;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`login:${ip}`, 15, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.` },
      { status: 429 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase environment variables are missing." }, { status: 500 });
  }

  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase();
  const rawPhone = payload.phone?.trim() ?? "";
  const phone = rawPhone.replace(/[^\d+]/g, ""); // Keep only digits and +
  const password = payload.password ?? "";
  const inputPin = payload.pincode?.trim() ?? "";
  const skipPin = payload.skipPin === true; // Requires PIN for Zealy logins unless skipPin is explicitly true

  if (!email || !phone || !password) {
    return NextResponse.json({ error: "Email, phone, and password are required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, alias_name, email, phone, password_hash, total_xp, pincode, checked_in, checked_in_at, promo_code, ticket_code, referral_count")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to verify login." }, { status: 400 });
  }

  const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").replace(/^(63|0)/, "");
  const normalizedInputPhone = normalizePhone(rawPhone);
  const normalizedDbPhone = data ? normalizePhone(data.phone || "") : "";

  if (!data || !verifyPassword(password, data.password_hash) || normalizedDbPhone !== normalizedInputPhone) {
    return NextResponse.json({ error: "Invalid email or phone number." }, { status: 401 });
  }

  const hasPin = Boolean(data.pincode && data.pincode.trim() !== "");

  if (hasPin && !skipPin) {
    if (!inputPin) {
      return NextResponse.json({
        error: "Security PIN code required.",
        hasPin: true,
        requiresPin: true
      }, { status: 401 });
    }
    if (inputPin !== data.pincode) {
      return NextResponse.json({
        error: "Incorrect Security PIN code.",
        hasPin: true,
        requiresPin: true
      }, { status: 401 });
    }
  }

  // Fetch completed quests to restore UI state
  const { data: completionsData } = await supabase
    .from("quest_completions")
    .select("*")
    .eq("registration_id", data.id);

  let completions = completionsData || [];
  const hasRegister = completions.some((c: any) => c.quest_id === "register");

  if (!hasRegister) {
    try {
      const newComp: Record<string, any> = {
        quest_id: "register",
        xp_awarded: 250,
        user_email: email,
        registration_id: data.id,
      };
      const { data: inserted } = await supabase
        .from("quest_completions")
        .insert(newComp)
        .select()
        .single();

      if (inserted) {
        completions = [...completions, inserted];
      } else {
        completions = [...completions, { ...newComp, created_at: new Date().toISOString() }];
      }
    } catch {
      completions = [...completions, { quest_id: "register", xp_awarded: 250, created_at: new Date().toISOString() }];
    }
  }

  // Auto-grant promo code bonus if user registered with a promo code and haven't received it yet
  const hasPromo = Boolean(data.promo_code && data.promo_code.trim());
  const hasPromoComp = completions.some((c: any) => c.quest_id === "promo-bonus" || c.quest_id === "media-partner-promo-code-bonus");
  if (hasPromo && !hasPromoComp) {
    try {
      const { data: promoInfo } = await supabase
        .from("promo_codes")
        .select("xp_bonus")
        .eq("code", data.promo_code.trim().toUpperCase())
        .maybeSingle();

      const promoXp = Number(promoInfo?.xp_bonus) || 250;
      const newPromoComp: Record<string, any> = {
        quest_id: "promo-bonus",
        xp_awarded: promoXp,
        user_email: email,
        registration_id: data.id,
      };

      const { data: insertedPromo } = await supabase
        .from("quest_completions")
        .insert(newPromoComp)
        .select()
        .single();

      if (insertedPromo) {
        completions = [...completions, insertedPromo];
      } else {
        completions = [...completions, { ...newPromoComp, created_at: new Date().toISOString() }];
      }
    } catch (promoErr) {
      console.warn("Could not auto-insert promo completion on login:", promoErr);
    }
  }

  const [verifRes, msgRes] = await Promise.all([
    supabase
      .from("quest_verifications")
      .select("id, quest_id, xp, status, user_message, proof_url, created_at")
      .ilike("user_email", email),
    supabase
      .from("quest_message_notes")
      .select("id, quest_id, xp, status, user_message, created_at")
      .ilike("user_email", email)
  ]);

  const { totalXp: exactTotalXp } = computeUserTotalXp({
    completions,
    verifications: verifRes.data || [],
    messageNotes: msgRes.data || [],
  });

  // Sync registrations table total_xp
  if (data.total_xp !== exactTotalXp) {
    await supabase
      .from("registrations")
      .update({ total_xp: exactTotalXp })
      .eq("id", data.id);
  }

  return NextResponse.json({
    message: "Login successful.",
    fullName: data.full_name,
    aliasName: data.alias_name || null,
    email: data.email,
    promoCode: data.promo_code || null,
    ticketCode: data.ticket_code || null,
    referralCount: data.referral_count || 0,
    totalXp: exactTotalXp,
    completedQuests: completions.map((c: any) => c.quest_id),
    hasPin,
    requiresPinSetup: !hasPin,
    isCheckedIn: Boolean(data.checked_in || (data as any).checked_in_at),
  });
}
