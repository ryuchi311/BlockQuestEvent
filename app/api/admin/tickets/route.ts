import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "../../../../utils/admin-auth";
import { sendEmailNotification } from "../../../../utils/email";

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

    if (data?.user_email && (admin_notes !== undefined || status)) {
      const ticketRef = data.ticket_ref || `#${data.id}`;
      const ticketStatus = data.status || status || "Updated";
      const subject = `[BlockQuest Fiesta Support] Update on Ticket ${ticketRef}: ${data.subject || "Your Request"}`;
      
      const notesHtml = data.admin_notes
        ? `<div style="background:#f8fafc;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px;font-size:14px;color:#1e293b;line-height:1.5;"><strong>Admin Message / Note:</strong><br/>${data.admin_notes.replace(/\n/g, "<br/>")}</div>`
        : "";

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
          <h2 style="color: #d97706; margin-bottom: 8px;">BlockQuest Fiesta PH — Support Update</h2>
          <p>Hello <strong>${data.user_name || "Adventurer"}</strong>,</p>
          <p>An administrator has reviewed your support ticket.</p>
          <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Ticket Reference:</strong> <span style="font-family:monospace;font-size:16px;color:#b45309;font-weight:bold;">${ticketRef}</span></p>
            <p style="margin: 4px 0;"><strong>Subject:</strong> ${data.subject || "Support Inquiry"}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:#e2e8f0;font-weight:bold;">${ticketStatus}</span></p>
          </div>
          ${notesHtml}
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            You can also check the live status of your ticket at any time by visiting <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://event.block-quest.com"}" style="color:#d97706;">BlockQuest Fiesta PH</a> and using the <strong>Check Ticket Status</strong> tool.
          </p>
        </div>
      `;

      // Dispatch async without delaying the response
      sendEmailNotification({
        to: data.user_email,
        subject,
        html,
      }).catch((emailErr) => console.warn("Failed sending ticket update email:", emailErr));
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
