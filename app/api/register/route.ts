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
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`register:${ip}`, 10, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.` },
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

  // 4. Insert registration record with initial XP bonus
  const { data: newReg, error } = await supabase
    .from("registrations")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) {
    const message =
      error.code === "23505"
        ? (error.message?.includes("alias")
            ? "That alias name is already taken. Please choose a different alias."
            : "That email, phone number, or alias is already registered.")
        : error.message || "Unable to store registration.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Record registration completion in quest_completions
  try {
    const completionPayload: Record<string, any> = {
      quest_id: "register",
      xp_awarded: initialXp,
    };
    if (newReg?.id) completionPayload.registration_id = newReg.id;
    if (newReg?.id) completionPayload.registration_id = newReg.id;

    await supabase.from("quest_completions").insert(completionPayload);
  } catch (compErr) {
    console.warn("Could not record quest completion for registration:", compErr);
  }

  return NextResponse.json(
    { message: successMessage, totalXp: initialXp },
    { status: 201 },
  );
}
