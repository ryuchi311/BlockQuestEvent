import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "../../../../utils/admin-auth";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// GET — List all support & feedback tickets for admin review
export async function GET(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "manager", "verifier", "viewer", "manage_attendees"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const statusParam = searchParams.get("status")?.trim();
    const typeParam = searchParams.get("type")?.trim();
    const priorityParam = searchParams.get("priority")?.trim();
    const searchParam = searchParams.get("search")?.trim().toLowerCase();

    const fetchLimit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 5000) : 2000;

    const supabase = getSupabase();
    let query = supabase
      .from("support_tickets")
      .select("id, ticket_ref, user_name, user_email, ticket_code, type, category, subject, description, priority, status, admin_notes, resolved_by, resolved_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (statusParam && statusParam !== "all") {
      query = query.eq("status", statusParam);
    }
    if (typeParam && typeParam !== "all") {
      query = query.eq("type", typeParam);
    }
    if (priorityParam && priorityParam !== "all") {
      query = query.eq("priority", priorityParam);
    }
    if (searchParam) {
      // Sanitize input to prevent PostgREST syntax injection (strip commas, colons, parentheses, backslashes, percent, quotes)
      const sanitized = searchParam.replace(/[,():"\\%*.]/g, "").trim();
      if (sanitized) {
        query = query.or(
          `ticket_ref.ilike.%${sanitized}%,user_name.ilike.%${sanitized}%,user_email.ilike.%${sanitized}%,subject.ilike.%${sanitized}%,ticket_code.ilike.%${sanitized}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: data || [] });
  } catch (err: any) {
    console.error("Admin tickets GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — Admin updates ticket status (Open -> In Progress -> Resolved -> Closed), adds response/admin_notes
export async function PATCH(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin", "manager", "verifier"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const id = Number(body.id);
    const { status, admin_notes, priority } = body;

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Valid numeric ticket ID is required." }, { status: 400 });
    }

    const reviewerName = auth.user?.fullName || auth.user?.email || "Admin";
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updatePayload.status = status;
      if (status === "Resolved" || status === "Closed") {
        updatePayload.resolved_by = reviewerName;
        updatePayload.resolved_at = new Date().toISOString();
      } else if (status === "Open" || status === "In Progress") {
        updatePayload.resolved_by = null;
        updatePayload.resolved_at = null;
      }
    }

    if (admin_notes !== undefined) {
      updatePayload.admin_notes = admin_notes;
    }

    if (priority) {
      updatePayload.priority = priority;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Admin ticket update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, ticket: data });
  } catch (err: any) {
    console.error("Admin tickets PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Admin removes or deletes spam ticket (superadmin / admin only)
export async function DELETE(request: Request) {
  const auth = verifyAdminAuth(request, ["superadmin", "admin"]);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id || isNaN(id) || id <= 0) return NextResponse.json({ error: "Valid numeric ticket ID is required." }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from("support_tickets").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
