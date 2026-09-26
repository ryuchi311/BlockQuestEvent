"use client";

import React, { useState } from "react";

interface FeedbackTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  defaultName?: string;
  defaultTicketCode?: string;
  onSuccess?: (ticketRef: string) => void;
}

export default function FeedbackTicketModal({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultName = "",
  defaultTicketCode = "",
  onSuccess,
}: FeedbackTicketModalProps) {
  const [ticketType, setTicketType] = useState<"feedback" | "issue" | "bug" | "question">("feedback");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [userName, setUserName] = useState(defaultName);
  const [userEmail, setUserEmail] = useState(defaultEmail);
  const [ticketCode, setTicketCode] = useState(defaultTicketCode);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<{ ref: string; subject: string; type: string } | null>(null);

  // Sync props when opening
  React.useEffect(() => {
    if (isOpen) {
      if (defaultEmail && !userEmail) setUserEmail(defaultEmail);
      if (defaultName && !userName) setUserName(defaultName);
      if (defaultTicketCode && !ticketCode) setTicketCode(defaultTicketCode);
      setError("");
      setSubmittedTicket(null);
    }
  }, [isOpen, defaultEmail, defaultName, defaultTicketCode]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!userEmail.trim() || !userEmail.includes("@")) {
      setError("Please provide a valid email address so staff can follow up.");
      return;
    }
    if (!subject.trim()) {
      setError("Please write a summary subject.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Please provide more details in the description (at least 10 characters).");
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
          priority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket");
      }

      setSubmittedTicket({
        ref: data.ticket?.ticket_ref || "TKT-LOGGED",
        subject: subject.trim(),
        type: ticketType,
      });

      if (onSuccess && data.ticket?.ticket_ref) {
        onSuccess(data.ticket.ticket_ref);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(5, 7, 15, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
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
          maxWidth: 520,
          background: "linear-gradient(145deg, #131726 0%, #0d101c 100%)",
          border: "1px solid rgba(245, 166, 35, 0.4)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 166, 35, 0.15)",
          borderRadius: 24,
          padding: "24px 22px",
          color: "#fff",
          maxHeight: "92vh",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {submittedTicket ? (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.4rem",
                margin: "0 auto 16px",
              }}
            >
              🎉
            </div>
            <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
              Ticket Created Successfully!
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 18px", lineHeight: 1.5 }}>
              Thank you for helping us make BlockQuest Fiesta PH better. Your submission has been routed directly to event admins.
            </p>

            <div
              style={{
                background: "rgba(245, 166, 35, 0.08)",
                border: "1px dashed rgba(245, 166, 35, 0.4)",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--gold-light)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Official Ticket Reference #
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffd166", letterSpacing: "2px", margin: "6px 0" }}>
                {submittedTicket.ref}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Subject: <strong style={{ color: "#fff" }}>{submittedTicket.subject}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)",
                color: "#100b02",
                fontWeight: 900,
                fontSize: "0.95rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(245, 166, 35, 0.35)",
              }}
            >
              Done & Return
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.4rem" }}>🎫</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                    Feedback & Issue Ticket
                  </h2>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  Share thoughts, report a bug, or open an official ticket for admin resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "var(--text-muted)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Ticket Type Selector */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 18 }}>
              {[
                { id: "feedback", label: "Feedback", icon: "💬" },
                { id: "issue", label: "Issue", icon: "⚠️" },
                { id: "bug", label: "Bug Report", icon: "🐛" },
                { id: "question", label: "Question", icon: "❓" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTicketType(t.id as any)}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 10,
                    border: ticketType === t.id ? "1px solid var(--gold-light)" : "1px solid rgba(255, 255, 255, 0.08)",
                    background: ticketType === t.id ? "rgba(245, 166, 35, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    color: ticketType === t.id ? "#ffd166" : "var(--text-secondary)",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Category & Priority Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      background: "rgba(11, 15, 25, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: "0.82rem",
                      outline: "none",
                    }}
                  >
                    <option value="general">🌐 General / Event</option>
                    <option value="quests">⚡ Quests & XP Claim</option>
                    <option value="qr_ticket">🎟️ QR Ticket & Entry</option>
                    <option value="booth">🏪 Sponsor Booths</option>
                    <option value="technical">🛠️ Tech / App Bug</option>
                    <option value="rewards">🎁 Prizes & Swag</option>
                    <option value="other">📌 Other Inquiries</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      background: "rgba(11, 15, 25, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: priority === "urgent" ? "#ef4444" : priority === "high" ? "#f59e0b" : "#fff",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  >
                    <option value="low">🟢 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🟠 High Priority</option>
                    <option value="urgent">🔴 Urgent / Blocker</option>
                  </select>
                </div>
              </div>

              {/* Name & Email Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Satoshi"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(11, 15, 25, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: "0.82rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                    Email Address *
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
                      background: "rgba(11, 15, 25, 0.9)",
                      border: "1px solid rgba(245, 166, 35, 0.35)",
                      color: "#fff",
                      fontSize: "0.82rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Pass / Ticket Code (Optional) */}
              <div>
                <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                  Event Ticket Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BQF-XXXXXX"
                  value={ticketCode}
                  onChange={(e) => setTicketCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(11, 15, 25, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#ffd166",
                    fontSize: "0.82rem",
                    letterSpacing: "1px",
                    fontWeight: 700,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Subject */}
              <div>
                <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: 700 }}>
                  Subject / Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    ticketType === "bug"
                      ? "e.g. Camera scanner cannot read booth QR"
                      : ticketType === "feedback"
                      ? "e.g. Suggestions for keynote speaker sessions"
                      : "e.g. Need assistance with ticket check-in"
                  }
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={150}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: 10,
                    background: "rgba(11, 15, 25, 0.9)",
                    border: "1px solid rgba(245, 166, 35, 0.35)",
                    color: "#fff",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <label style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                    Detailed Description / Feedback *
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {description.length}/2000
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  maxLength={2000}
                  placeholder="Describe your feedback, thoughts, or step-by-step issue in detail so event organizers can take immediate action..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: "rgba(11, 15, 25, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
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
                  padding: "13px",
                  borderRadius: 12,
                  background: loading
                    ? "rgba(255, 255, 255, 0.15)"
                    : "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)",
                  color: "#100b02",
                  fontWeight: 900,
                  fontSize: "0.95rem",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 18px rgba(245, 166, 35, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? "Submitting Ticket..." : "🚀 Submit to Admin Team"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
