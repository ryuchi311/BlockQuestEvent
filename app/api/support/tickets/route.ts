import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function generateTicketRef(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(4);
  let ref = "TKT-";
  for (let i = 0; i < 6; i++) {
    ref += chars[bytes[i % bytes.length] % chars.length];
  }
  return ref;
}

// GET — Quester fetches their submitted tickets (by ?email=) or checks specific ticket (by ?ref=)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const ref = searchParams.get("ref")?.trim().toUpperCase();

    if (!email && !ref) {
      return NextResponse.json({ error: "Email or ticket reference is required." }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase
      .from("support_tickets")
      .select("id, ticket_ref, user_name, user_email, ticket_code, type, category, subject, description, priority, status, admin_notes, resolved_by, resolved_at, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (ref) {
      query = query.eq("ticket_ref", ref);
    } else if (email) {
      query = query.ilike("user_email", email);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — User submits feedback or reports an issue/bug/ticket
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_name,
      user_email,
      ticket_code,
      type = "feedback",
      category = "general",
      subject,
      description,
      priority = "medium",
    } = body;

    const cleanEmail = (user_email || "").trim().toLowerCase();
    const cleanName = (user_name || "").trim();
    const cleanSubject = (subject || "").trim();
    const cleanDesc = (description || "").trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required to submit feedback or create a ticket." }, { status: 400 });
    }
    if (!cleanSubject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (!cleanDesc) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if attendee is registered in the database for auto-linking ticket code & full name
    let detectedTicketCode = ticket_code ? String(ticket_code).trim().toUpperCase() : null;
    let detectedName = cleanName;

    const { data: regUser } = await supabase
      .from("registrations")
      .select("id, full_name, ticket_code")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (regUser) {
      if (!detectedTicketCode && regUser.ticket_code) {
        detectedTicketCode = regUser.ticket_code;
      }
      if (!detectedName && regUser.full_name) {
        detectedName = regUser.full_name;
      }
    }

    if (!detectedName) {
      detectedName = cleanEmail.split("@")[0];
    }

    // Generate unique Ticket Ref
    let ticketRef = generateTicketRef();
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: existing } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("ticket_ref", ticketRef)
        .maybeSingle();
      if (!existing) break;
      ticketRef = generateTicketRef();
    }

    const validTypes = ["feedback", "issue", "bug", "question", "complaint"];
    const validType = validTypes.includes(type) ? type : "feedback";

    const validCategories = ["general", "quests", "qr_ticket", "booth", "rewards", "technical", "other"];
    const validCategory = validCategories.includes(category) ? category : "general";

    const validPriorities = ["low", "medium", "high", "urgent"];
    const validPriority = validPriorities.includes(priority) ? priority : "medium";

    const newTicket = {
      ticket_ref: ticketRef,
      user_name: detectedName,
      user_email: cleanEmail,
      ticket_code: detectedTicketCode,
      type: validType,
      category: validCategory,
      subject: cleanSubject.slice(0, 180),
      description: cleanDesc.slice(0, 2500),
      priority: validPriority,
      status: "Open",
      admin_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("support_tickets")
      .insert(newTicket)
      .select()
      .single();

    if (error) {
      console.error("Failed to insert support ticket:", error);
      return NextResponse.json({ error: error.message || "Failed to create ticket" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ticket: data,
      message: `Your ticket has been logged successfully with Reference #${ticketRef}. Our staff will address it promptly!`,
    }, { status: 201 });
  } catch (err: any) {
    console.error("Support ticket POST error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
