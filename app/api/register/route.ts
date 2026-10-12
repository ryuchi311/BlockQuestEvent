import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashPassword } from "../../../utils/registration-password";
import { getClientIp, checkRateLimit } from "../../../utils/rate-limit";

export const runtime = "nodejs";

type RegistrationPayload = {
  fullName?: string;
  aliasName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  password?: string;
  terms?: boolean;
  dataGathering?: boolean;
  promoCode?: string;
  referralCode?: string;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Rate limit registration requests to a maximum of 2 successful/attempted per IP per 24 hours
  // to prevent referral farming and multi-account spam.
  const ipLimit = checkRateLimit(`register_ip_strict:${ip}`, 2, 24 * 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Maximum registration limit reached for this IP network (Max 2 accounts per IP). Please connect using personal mobile data to register." },
      { status: 429 }
    );
  }

  // Short burst limit: max 5 requests per minute
  const burstLimit = checkRateLimit(`register_burst:${ip}`, 5, 60000);
  if (!burstLimit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Please wait ${burstLimit.resetInSeconds} seconds before trying again.` },
      { status: 429 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 },
    );
  }

  let payload: RegistrationPayload;

  try {
    payload = (await request.json()) as RegistrationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim();
  const aliasName = payload.aliasName?.trim() || null;
  const email = payload.email?.trim().toLowerCase();
  const rawPhone = payload.phone?.trim() ?? "";
  const phone = rawPhone.replace(/[^\d+]/g, ""); // Keep only digits and +
  const organization = payload.organization?.trim() || null;
  const password = payload.password ?? "";
  const promoCode = payload.promoCode?.trim() || null;
  const referralCode = (payload.referralCode || "").trim();

  if (!fullName || !email || !phone || !password || payload.terms !== true || payload.dataGathering !== true) {
    return NextResponse.json(
      { error: "Missing required registration details." },
      { status: 400 },
    );
  }

  // Validate email address format (must have a valid local part, @ symbol, and domain with extension)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address with a valid domain (e.g. name@domain.com)." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 1. Check existing email
  const { data: existingEmail } = await supabase
    .from("registrations")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    return NextResponse.json(
      { error: "That email is already registered." },
      { status: 400 },
    );
  }

  // 2. Check existing mobile phone number (normalized digits)
  const newPhoneNorm = phone.replace(/[^\d]/g, "").replace(/^(63|0)/, "");
  const { data: existingPhones } = await supabase
    .from("registrations")
    .select("id, phone");

  const phoneDuplicate = existingPhones?.some((r) => {
    const existingNorm = (r.phone || "").replace(/[^\d]/g, "").replace(/^(63|0)/, "");
    return existingNorm && newPhoneNorm && existingNorm === newPhoneNorm;
  });

  if (phoneDuplicate) {
    return NextResponse.json(
      { error: "That mobile phone number is already registered to another attendee account." },
      { status: 400 },
    );
  }

  // 3. Check existing alias name if provided
  let finalAliasName: string | null = null;
  if (aliasName) {
    const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!ALIAS_REGEX.test(aliasName)) {
      return NextResponse.json(
        { error: "Alias must be 3-20 characters long and can only contain letters, numbers, underscores (_), and hyphens (-)." },
        { status: 400 }
      );
    }
    const { data: existingAlias } = await supabase
      .from("registrations")
      .select("id")
      .ilike("alias_name", aliasName)
      .maybeSingle();

    if (existingAlias) {
      return NextResponse.json(
        { error: `The alias "${aliasName}" is already taken. Please choose another alias.` },
        { status: 409 }
      );
    }
    finalAliasName = aliasName;
  }

  let initialXp = 250;
  let successMessage = "Registration saved successfully. +250 XP awarded!";
  let finalPromoCode = null;

  if (promoCode) {
    const { data: promoData, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", promoCode.trim().toUpperCase())
      .single();

    if (promoData && promoData.is_active) {
      if (promoData.max_uses === null || promoData.usage_count < promoData.max_uses) {
        finalPromoCode = promoData.code;
        successMessage = `Registration saved successfully. Promo code ${promoData.code} applied! Claim your +250 XP Promo Bonus quest in your quest line.`;
        
        // Increment usage count in the background
        supabase.rpc('increment_promo_usage', { p_code: promoData.code }).then((res) => {
          if (res.error) {
            // fallback if RPC doesn't exist
            supabase.from("promo_codes").update({ usage_count: promoData.usage_count + 1 }).eq("code", promoData.code).then();
          }
        });
      }
    }
  }

  // 4. Check referral code if provided
  let referrerRecord: any = null;
  let finalReferredByCode: string | null = null;
  if (referralCode) {
    // Check by ticket_code first, then by alias_name
    const { data: refByTicket } = await supabase
      .from("registrations")
      .select("id, full_name, alias_name, ticket_code, email, total_xp, referral_count")
      .eq("ticket_code", referralCode.toUpperCase())
      .maybeSingle();

    if (refByTicket) {
      referrerRecord = refByTicket;
      finalReferredByCode = refByTicket.ticket_code;
    } else {
      const { data: refByAlias } = await supabase
        .from("registrations")
        .select("id, full_name, alias_name, ticket_code, email, total_xp, referral_count")
        .ilike("alias_name", referralCode)
        .maybeSingle();

      if (refByAlias) {
        referrerRecord = refByAlias;
        finalReferredByCode = refByAlias.alias_name || refByAlias.ticket_code;
      }
    }
  }

  // 5. Insert registration record with initial XP bonus (storing registration_ip for anti-abuse)
  const insertPayload: Record<string, any> = {
    full_name: fullName,
    alias_name: finalAliasName,
    email,
    phone,
    organization,
    password_hash: hashPassword(password),
    agreed_to_terms: true,
    agreed_to_data_gathering: true,
    agreed_at: new Date().toISOString(),
    total_xp: initialXp,
    promo_code: finalPromoCode,
    referred_by_code: finalReferredByCode,
    registration_ip: ip,
  };

  const { data: newReg, error } = await supabase
    .from("registrations")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    // Fallback if registration_ip column does not exist yet in Supabase
    if (error.message?.includes("registration_ip")) {
      delete insertPayload.registration_ip;
      const { data: retryReg, error: retryError } = await supabase
        .from("registrations")
        .insert(insertPayload)
        .select("id")
        .single();

      if (retryError) {
        const message =
          retryError.code === "23505"
            ? (retryError.message?.includes("alias")
                ? "That alias name is already taken. Please choose a different alias."
                : "That email, phone number, or alias is already registered.")
            : retryError.message || "Unable to store registration.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      (newReg as any) = retryReg;
    } else {
      const message =
        error.code === "23505"
          ? (error.message?.includes("alias")
              ? "That alias name is already taken. Please choose a different alias."
              : "That email, phone number, or alias is already registered.")
          : error.message || "Unable to store registration.";

      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // 6. Record registration completion in quest_completions
  try {
    const completionPayload: Record<string, any> = {
      quest_id: "register",
      xp_awarded: initialXp,
    };
    if (newReg?.id) completionPayload.registration_id = newReg.id;

    await supabase.from("quest_completions").insert(completionPayload);
  } catch (compErr) {
    console.warn("Could not record quest completion for registration:", compErr);
  }

  // 7. If valid referrer found, award referrer +100 XP (MAX 5 REFERRALS PER USER)
  if (referrerRecord && referrerRecord.id !== newReg?.id) {
    try {
      const currentRefCount = Number(referrerRecord.referral_count) || 0;
      const MAX_REFERRALS = 5;

      if (currentRefCount < MAX_REFERRALS) {
        const currentXp = Number(referrerRecord.total_xp) || 0;
        const newRefCount = currentRefCount + 1;
        const bonusXp = 100;
        const newTotalXp = currentXp + bonusXp;

        // Update referrer record
        await supabase
          .from("registrations")
          .update({
            referral_count: newRefCount,
            total_xp: newTotalXp,
          })
          .eq("id", referrerRecord.id);

        // Log in quest_verifications for the referrer so it appears in their Quest Logs
        const inviteeDisplayName = finalAliasName ? `@${finalAliasName}` : fullName;
        await supabase.from("quest_verifications").insert({
          quest_id: "referral-quest",
          quest_title: `Referral Quest: Friend Joined (${newRefCount}/${MAX_REFERRALS})`,
          user_name: referrerRecord.alias_name ? `@${referrerRecord.alias_name}` : referrerRecord.full_name,
          user_email: referrerRecord.email,
          xp: bonusXp,
          proof_url: "Auto-Verified (Friend Registered)",
          user_message: `Friend registered: ${inviteeDisplayName} (${newRefCount}/${MAX_REFERRALS} referrals claimed)`,
          status: "Approved",
          approved_by: "System",
          reviewed_at: new Date().toISOString(),
        });
      } else {
        // Referrer already reached the max cap of 5 referrals
        console.log(`[Referral] Referrer ${referrerRecord.email} has already reached the maximum ${MAX_REFERRALS} referrals limit.`);
      }
    } catch (refErr) {
      console.warn("Could not update referrer XP or logs:", refErr);
    }
  }

  return NextResponse.json(
    { message: successMessage, totalXp: initialXp },
    { status: 201 },
  );
}
