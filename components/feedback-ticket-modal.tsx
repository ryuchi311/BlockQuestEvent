"use client";

import React, { useState } from "react";

interface FeedbackTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  defaultName?: string;
  defaultTicketCode?: string;
  initialMode?: "create" | "status";
  onSuccess?: (ticketRef: string) => void;
}

interface SupportTicketRecord {
  id: number;
  ticket_ref: string;
  user_name: string;
  user_email: string;
  ticket_code: string | null;
  type: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function FeedbackTicketModal({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultName = "",
  defaultTicketCode = "",
  initialMode = "create",
  onSuccess,
}: FeedbackTicketModalProps) {
  const [activeTab, setActiveTab] = useState<"create" | "status">(initialMode);
  const [ticketType, setTicketType] = useState<"feedback" | "issue" | "bug" | "question">("feedback");
  const [category, setCategory] = useState("general");
  const [userName, setUserName] = useState(defaultName);
  const [userEmail, setUserEmail] = useState(defaultEmail);
  const [ticketCode, setTicketCode] = useState(defaultTicketCode);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<{ ref: string; subject: string; type: string } | null>(null);

  // Status Lookup States
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [foundTickets, setFoundTickets] = useState<SupportTicketRecord[] | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Sync props when opening
  React.useEffect(() => {
    if (isOpen) {
      if (defaultEmail && !userEmail) setUserEmail(defaultEmail);
      if (defaultName && !userName) setUserName(defaultName);
      if (defaultTicketCode && !ticketCode) setTicketCode(defaultTicketCode);
      if (defaultEmail && !lookupQuery) setLookupQuery(defaultEmail);
      setActiveTab(initialMode);
      setError("");
      setLookupError("");
      setSubmittedTicket(null);
      setCopiedRef(null);
    }
  }, [isOpen, defaultEmail, defaultName, defaultTicketCode, initialMode]);

  if (!isOpen) return null;

  async function handleLookup(e?: React.FormEvent, overrideQuery?: string) {
    if (e) e.preventDefault();
    const query = (overrideQuery ?? lookupQuery).trim();
    if (!query) {
      setLookupError("Please enter your Ticket Reference (e.g. TKT-ABC123) or your registered Email.");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    setFoundTickets(null);

    try {
      const isEmail = query.includes("@");
      const param = isEmail ? `email=${encodeURIComponent(query.toLowerCase())}` : `ref=${encodeURIComponent(query.toUpperCase())}`;
      const res = await fetch(`/api/support/tickets?${param}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search tickets.");
      
      const list: SupportTicketRecord[] = data.tickets || [];
      if (list.length === 0) {
        setLookupError(`No tickets found for "${query}". Check your reference or email.`);
      } else {
        setFoundTickets(list);
      }
    } catch (err: any) {
      setLookupError(err.message || "An error occurred while fetching ticket.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!userEmail.trim() || !userEmail.includes("@")) {
      setError("Please provide a valid email address so staff can follow up.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a short subject.");
      return;
    }
    if (!description.trim() || description.trim().length < 8) {
      setError("Please describe your request in a bit more detail (at least 8 characters).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: userName.trim() || userEmail.split("@")[0],
          user_email: userEmail.trim().toLowerCase(),
          ticket_code: ticketCode.trim().toUpperCase() || undefined,
          type: ticketType,
          category,
          subject: subject.trim(),
          description: description.trim(),
          priority: category === "forgot_pin" ? "high" : "medium",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }

      const generatedRef = data.ticket?.ticket_ref || "TKT-LOGGED";
      setSubmittedTicket({
        ref: generatedRef,
        subject: subject.trim(),
        type: ticketType,
      });
      setLookupQuery(generatedRef);

      if (onSuccess && data.ticket?.ticket_ref) {
        onSuccess(data.ticket.ticket_ref);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Resolved":
        return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)", color: "#34d399", label: "Resolved", icon: "✓" };
      case "Closed":
        return { bg: "rgba(100, 116, 139, 0.2)", border: "rgba(100, 116, 139, 0.4)", color: "#94a3b8", label: "Closed", icon: "●" };
      case "In Progress":
        return { bg: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.45)", color: "#fbbf24", label: "In Progress", icon: "⏳" };
      default:
        return { bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.4)", color: "#60a5fa", label: "Open / Pending", icon: "📩" };
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(4, 7, 16, 0.85)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          background: "linear-gradient(180deg, #161b2e 0%, #0d111d 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 25px 65px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.05)",
          borderRadius: 20,
          color: "#fff",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.015)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0.05) 100%)",
                border: "1px solid rgba(245, 166, 35, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              🎫
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, letterSpacing: "-0.01em", color: "#fff" }}>
                Support & Helpdesk
              </h2>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "2px 0 0" }}>
                Submit requests, resolve PIN locks, or view admin notes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#94a3b8",
              width: 32,
              height: 32,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.95rem",
              transition: "all 0.15s ease",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {submittedTicket ? (
            /* Successful Creation Confirmation Screen */
            <div style={{ textAlign: "center", padding: "12px 4px 6px" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  margin: "0 auto 16px",
                }}
              >
                ✓
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                Support Ticket Submitted!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.5 }}>
                Our event admin team has received your ticket. Keep your reference number to track replies and PIN resets:
              </p>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(245, 166, 35, 0.35)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                    Your Ticket Ref #
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#fff", fontFamily: "monospace", letterSpacing: "1px", marginTop: 2 }}>
                    {submittedTicket.ref}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                    Subject: {submittedTicket.subject}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(submittedTicket.ref)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: copiedRef === submittedTicket.ref ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    border: `1px solid ${copiedRef === submittedTicket.ref ? "#10b981" : "rgba(255, 255, 255, 0.15)"}`,
                    color: copiedRef === submittedTicket.ref ? "#34d399" : "#fff",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {copiedRef === submittedTicket.ref ? "Copied! ✓" : "Copy Code 📋"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    const refToLookup = submittedTicket.ref;
                    setSubmittedTicket(null);
                    setActiveTab("status");
                    setLookupQuery(refToLookup);
                    handleLookup(undefined, refToLookup);
                  }}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "#f8fafc",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Track This Ticket Now
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Done & Return
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Segmented Tab Pill Navigation */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  background: "rgba(0, 0, 0, 0.35)",
                  padding: 4,
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  marginBottom: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: activeTab === "create" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    color: activeTab === "create" ? "#fff" : "#94a3b8",
                    fontWeight: activeTab === "create" ? 800 : 600,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.15s ease",
                    boxShadow: activeTab === "create" ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  <span>✏️</span> Open New Ticket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("status");
                    if (lookupQuery && (!foundTickets || foundTickets.length === 0)) {
                      handleLookup();
                    }
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9,
                    border: "none",
                    background: activeTab === "status" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    color: activeTab === "status" ? "#fff" : "#94a3b8",
                    fontWeight: activeTab === "status" ? 800 : 600,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.15s ease",
                    boxShadow: activeTab === "status" ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  <span>🔍</span> Check Status & Admin Notes
                </button>
              </div>

              {activeTab === "status" ? (
                /* ─────────────────────────────────────────────────────────────
                   TAB 2: CHECK TICKET STATUS & ADMIN NOTES
                   ───────────────────────────────────────────────────────────── */
                <div>
                  <form onSubmit={(e) => handleLookup(e)} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1" }}>
                        Ticket Reference # or Registered Email:
                      </label>
                      {userEmail && lookupQuery !== userEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setLookupQuery(userEmail);
                            handleLookup(undefined, userEmail);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#fbbf24",
                            fontSize: "0.72rem",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Use my email ({userEmail})
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="e.g. TKT-KK55KK or you@gmail.com"
                        value={lookupQuery}
                        onChange={(e) => setLookupQuery(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "11px 14px",
                          borderRadius: 10,
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#fff",
                          fontSize: "0.88rem",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={lookupLoading}
                        style={{
                          padding: "0 20px",
                          borderRadius: 10,
                          background: lookupLoading
                            ? "rgba(255, 255, 255, 0.12)"
                            : "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                          color: "#0f172a",
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          border: "none",
                          cursor: lookupLoading ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "opacity 0.15s ease",
                        }}
                      >
                        {lookupLoading ? "Searching..." : "Track Status 🔎"}
                      </button>
                    </div>
                  </form>

                  {lookupError && (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#fca5a5",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>⚠️</span>
                      <span>{lookupError}</span>
                    </div>
                  )}

                  {foundTickets && foundTickets.length > 0 && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                          padding: "0 2px",
                        }}
                      >
                        <span style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Found Tickets ({foundTickets.length})
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                          Updated in real time
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {foundTickets.map((t) => {
                          const badge = getStatusBadge(t.status);
                          return (
                            <div
                              key={t.id}
                              style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: 14,
                                padding: "18px 20px",
                                position: "relative",
                              }}
                            >
                              {/* Ticket Header & Status Badge */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  marginBottom: 10,
                                }}
                              >
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                      style={{
                                        fontFamily: "monospace",
                                        color: "#fbbf24",
                                        fontWeight: 800,
                                        fontSize: "0.82rem",
                                        letterSpacing: "0.5px",
                                      }}
                                    >
                                      #{t.ticket_ref}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(t.ticket_ref)}
                                      title="Copy reference code"
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                        fontSize: "0.75rem",
                                        color: copiedRef === t.ticket_ref ? "#34d399" : "#64748b",
                                      }}
                                    >
                                      {copiedRef === t.ticket_ref ? "Copied!" : "📋"}
                                    </button>
                                  </div>
                                  <h4 style={{ margin: "4px 0 0", fontSize: "1.05rem", color: "#fff", fontWeight: 700 }}>
                                    {t.subject}
                                  </h4>
                                </div>

                                <div
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 8,
                                    background: badge.bg,
                                    border: `1px solid ${badge.border}`,
                                    color: badge.color,
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span>{badge.icon}</span>
                                  <span>{badge.label}</span>
                                </div>
                              </div>

                              {/* Quester Original Issue */}
                              <p style={{ fontSize: "0.84rem", color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.5 }}>
                                {t.description}
                              </p>

                              {/* Official Admin Note Box */}
                              <div
                                style={{
                                  borderRadius: 12,
                                  background: t.admin_notes
                                    ? "linear-gradient(145deg, rgba(245, 166, 35, 0.08) 0%, rgba(245, 166, 35, 0.03) 100%)"
                                    : "rgba(0, 0, 0, 0.25)",
                                  border: t.admin_notes
                                    ? "1px solid rgba(245, 166, 35, 0.35)"
                                    : "1px dashed rgba(255, 255, 255, 0.1)",
                                  padding: "14px 16px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: "0.95rem" }}>💬</span>
                                    <span
                                      style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 800,
                                        color: t.admin_notes ? "#fbbf24" : "#94a3b8",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                      }}
                                    >
                                      {t.admin_notes ? "Official Admin Support Note:" : "Admin Support Response:"}
                                    </span>
                                  </div>

                                  {t.resolved_by && (
                                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                                      Staff: <strong style={{ color: "#e2e8f0" }}>{t.resolved_by}</strong>
                                    </span>
                                  )}
                                </div>

                                {t.admin_notes ? (
                                  <div
                                    style={{
                                      fontSize: "0.92rem",
                                      color: "#ffffff",
                                      lineHeight: 1.55,
                                      whiteSpace: "pre-wrap",
                                      fontWeight: 500,
                                      padding: "4px 0",
                                    }}
                                  >
                                    {t.admin_notes}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic", lineHeight: 1.45 }}>
                                    Awaiting admin review. When staff replies or issues your temporary PIN, their resolution will appear here immediately and via email.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!foundTickets && !lookupLoading && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "28px 16px",
                        background: "rgba(255, 255, 255, 0.02)",
                        borderRadius: 14,
                        border: "1px dashed rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🔎</span>
                      <p style={{ margin: "0 0 4px", fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0" }}>
                        Track any support ticket anytime
                      </p>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", maxWidth: 360, marginInline: "auto" }}>
                        Enter your ticket reference code (e.g. <code>TKT-KK55KK</code>) or your email to read replies from the event team.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* ─────────────────────────────────────────────────────────────
                   TAB 1: CREATE NEW SUPPORT TICKET
                   ───────────────────────────────────────────────────────────── */
                <div>
                  {/* Category Pill Selectors */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      What do you need help with?
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      {[
                        { id: "forgot_pin", type: "issue", label: "Forgot PIN", icon: "🔑", desc: "PIN Recovery" },
                        { id: "qr_scan", type: "bug", label: "QR / Pass", icon: "📱", desc: "Scanner issue" },
                        { id: "quests", type: "issue", label: "Quest / XP", icon: "⚡", desc: "Verification" },
                        { id: "general", type: "feedback", label: "General", icon: "💬", desc: "Feedback/Ask" },
                      ].map((item) => {
                        const isSelected = category === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setCategory(item.id);
                              setTicketType(item.type as any);
                              if (item.id === "forgot_pin" && !subject) {
                                setSubject("Forgot Security PIN — Requesting Reset");
                              }
                            }}
                            style={{
                              padding: "10px 6px",
                              borderRadius: 12,
                              border: isSelected
                                ? "1px solid rgba(245, 166, 35, 0.7)"
                                : "1px solid rgba(255, 255, 255, 0.08)",
                              background: isSelected
                                ? "rgba(245, 166, 35, 0.14)"
                                : "rgba(255, 255, 255, 0.02)",
                              color: isSelected ? "#ffd166" : "#94a3b8",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 4,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                            <span style={{ fontSize: "0.76rem", fontWeight: isSelected ? 800 : 600 }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 5 }}>
                          Your Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Quester Name"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "rgba(0, 0, 0, 0.35)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#fff",
                            fontSize: "0.85rem",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 5 }}>
                          Registered Email *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@email.com"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "rgba(0, 0, 0, 0.35)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#fff",
                            fontSize: "0.85rem",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 5 }}>
                        Summary Subject *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Forgot PIN code or Need help unlocking account"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(0, 0, 0, 0.35)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#fff",
                          fontSize: "0.85rem",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 5 }}>
                        Details / Message *
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Please describe what you need help with so staff can respond immediately..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(0, 0, 0, 0.35)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#fff",
                          fontSize: "0.85rem",
                          outline: "none",
                          resize: "vertical",
                          boxSizing: "border-box",
                          lineHeight: 1.45,
                        }}
                      />
                    </div>

                    {error && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#fca5a5",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 10,
                        background: loading
                          ? "rgba(255, 255, 255, 0.15)"
                          : "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                        color: "#0f172a",
                        fontWeight: 900,
                        fontSize: "0.92rem",
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 16px rgba(245, 166, 35, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        marginTop: 4,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {loading ? "Submitting..." : "Send Ticket to Admins 🚀"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
