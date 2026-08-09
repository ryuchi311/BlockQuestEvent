"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const QrScanner = dynamic(() => import("../../components/qr-scanner"), { ssr: false, loading: () => <p className="admin-loading">Loading scanner…</p> });

// ─── Types ───────────────────────────────────────────────────────────────────
interface Attendee {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  organization: string | null;
  ticket_code: string | null;
  checked_in?: boolean;
  checked_in_at?: string | null;
  created_at: string;
}

interface Quest {
  id: string;
  title: string;
  description: string | null;
  xp: number;
  status: "Live" | "Soon" | "Done" | "Draft";
  category: "onboarding" | "social" | "daily";
  action_label: string | null;
  action_url: string | null;
  requires_proof?: boolean;
  sort_order: number;
}

interface QuestVerification {
  id: number;
  quest_id: string;
  quest_title: string;
  user_name: string;
  user_email: string;
  ticket_code: string | null;
  xp: number;
  proof_url: string;
  status: "Pending" | "Approved" | "Rejected";
  created_at: string;
}

const ADMIN_TABS = ["scanner", "attendees", "quests", "verifications"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const STATUS_OPTIONS: Quest["status"][] = ["Live", "Soon", "Done", "Draft"];
const CATEGORY_OPTIONS: Quest["category"][] = ["onboarding", "social", "daily"];

const EMPTY_QUEST: Omit<Quest, "created_at" | "updated_at"> = {
  id: "",
  title: "",
  description: "",
  xp: 100,
  status: "Draft",
  category: "onboarding",
  action_label: "",
  action_url: "",
  requires_proof: false,
  sort_order: 99,
};

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
export default function AdminPage() {
  // ── Auth gate ──
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // ── Tabs & data ──
  const [tab, setTab] = useState<AdminTab>("attendees");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [verifications, setVerifications] = useState<QuestVerification[]>([]);
  const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Attendee search & filter ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked" | "pending">("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // ── Quest modal ──
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [questForm, setQuestForm] = useState<typeof EMPTY_QUEST>({ ...EMPTY_QUEST });
  const [questSaving, setQuestSaving] = useState(false);
  const [questError, setQuestError] = useState("");

  // ── Copy tooltip ──
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ─── Auth ────────────────────────────────────────────────────────────────
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === "blockquest2026") {
      setAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect admin password.");
    }
  }

  // ─── Fetch data ──────────────────────────────────────────────────────────
  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/attendees");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load attendees.");
      setAttendees(json.attendees ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/quests");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load quests.");
      setQuests(json.quests ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verifications");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load verifications.");
      setVerifications(json.verifications ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === "attendees") fetchAttendees();
    else if (tab === "quests") fetchQuests();
    else if (tab === "verifications") fetchVerifications();
  }, [authed, tab, fetchAttendees, fetchQuests, fetchVerifications]);

  // ── Auto Refresh ──
  useEffect(() => {
    if (!authed || !autoRefresh || tab === "scanner") return;
    const interval = setInterval(() => {
      if (tab === "attendees") fetchAttendees();
      else if (tab === "quests") fetchQuests();
      else if (tab === "verifications") fetchVerifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [authed, autoRefresh, tab, fetchAttendees, fetchQuests, fetchVerifications]);

  async function handleVerifyQuest(id: number, newStatus: "Approved" | "Rejected") {
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update verification.");
      setVerifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err: any) {
      alert("Verification Error: " + err.message);
    }
  }

  // ─── Attendee helpers ────────────────────────────────────────────────────
  const filteredAttendees = attendees.filter((a) => {
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.ticket_code ?? "").toLowerCase().includes(q) ||
      (a.organization ?? "").toLowerCase().includes(q);

    if (!matchesQuery) return false;
    if (statusFilter === "checked") return !!a.checked_in;
    if (statusFilter === "pending") return !a.checked_in;
    return true;
  });

  function copyTicket(attendee: Attendee) {
    navigator.clipboard.writeText(attendee.ticket_code ?? "");
    setCopiedId(attendee.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleManualCheckIn(attendee: Attendee) {
    if (!attendee.ticket_code) return;
    setCheckingInId(attendee.id);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_code: attendee.ticket_code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to check in attendee.");
      setAttendees((prev) =>
        prev.map((item) =>
          item.id === attendee.id
            ? { ...item, checked_in: true, checked_in_at: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      alert("Check-in Error: " + err.message);
    } finally {
      setCheckingInId(null);
    }
  }

  function exportToCSV() {
    if (filteredAttendees.length === 0) return;
    const headers = ["ID", "Full Name", "Email", "Phone", "Organization", "Ticket Code", "Checked In", "Checked In At", "Registered At"];
    const rows = filteredAttendees.map((a) => [
      a.id,
      `"${(a.full_name || "").replace(/"/g, '""')}"`,
      `"${(a.email || "").replace(/"/g, '""')}"`,
      `"${(a.phone || "").replace(/"/g, '""')}"`,
      `"${(a.organization || "").replace(/"/g, '""')}"`,
      `"${a.ticket_code || ""}"`,
      a.checked_in ? "Yes" : "No",
      a.checked_in_at ? `"${new Date(a.checked_in_at).toLocaleString()}"` : "",
      `"${new Date(a.created_at).toLocaleString()}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `blockquest_attendees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ─── Quest helpers ───────────────────────────────────────────────────────
  function openAddQuest() {
    setEditingQuest(null);
    setQuestForm({ ...EMPTY_QUEST });
    setQuestError("");
    setShowQuestModal(true);
  }

  function openEditQuest(q: Quest) {
    setEditingQuest(q);
    setQuestForm({
      id: q.id,
      title: q.title,
      description: q.description ?? "",
      xp: q.xp,
      status: q.status,
      category: q.category,
      action_label: q.action_label ?? "",
      action_url: q.action_url ?? "",
      requires_proof: q.requires_proof ?? false,
      sort_order: q.sort_order,
    });
    setQuestError("");
    setShowQuestModal(true);
  }

  async function saveQuest(e: React.FormEvent) {
    e.preventDefault();
    setQuestSaving(true);
    setQuestError("");
    try {
      const isEdit = !!editingQuest;
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        ...questForm,
        xp: Number(questForm.xp),
        sort_order: Number(questForm.sort_order),
        action_label: questForm.action_label || null,
        action_url: questForm.action_url || null,
        description: questForm.description || null,
      };
      const res = await fetch("/api/admin/quests", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save quest.");
      setShowQuestModal(false);
      fetchQuests();
    } catch (err: any) {
      setQuestError(err.message);
    } finally {
      setQuestSaving(false);
    }
  }

  async function deleteQuest(id: string) {
    if (!confirm(`Delete quest "${id}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/quests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error);
      }
      setQuests((prev) => prev.filter((q) => q.id !== id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function toggleStatus(quest: Quest) {
    const cycle: Record<Quest["status"], Quest["status"]> = {
      Draft: "Soon",
      Soon: "Live",
      Live: "Done",
      Done: "Draft",
    };
    const newStatus = cycle[quest.status];
    try {
      const res = await fetch("/api/admin/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quest.id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, status: newStatus } : q)));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function publishQuest(quest: Quest) {
    try {
      const res = await fetch("/api/admin/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quest.id, status: "Live" }),
      });
      if (!res.ok) throw new Error("Failed to publish quest.");
      setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, status: "Live" } : q)));
    } catch (err: any) {
      alert("Publish Error: " + err.message);
    }
  }

  async function saveDraftQuest(e: React.FormEvent) {
    e.preventDefault();
    setQuestSaving(true);
    setQuestError("");
    try {
      const isEdit = !!editingQuest;
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        ...questForm,
        status: "Draft" as Quest["status"],
        xp: Number(questForm.xp),
        sort_order: Number(questForm.sort_order),
        action_label: questForm.action_label || null,
        action_url: questForm.action_url || null,
        description: questForm.description || null,
      };
      const res = await fetch("/api/admin/quests", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save draft.");
      setShowQuestModal(false);
      fetchQuests();
    } catch (err: any) {
      setQuestError(err.message);
    } finally {
      setQuestSaving(false);
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────────────
  const totalXpPool = quests.reduce((sum, q) => sum + (q.xp ?? 0), 0);
  const liveQuestCount = quests.filter((q) => q.status === "Live").length;

  // ─── Login gate ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-logo">
            <img
              src="https://block-quest.com/assets/images/block_quest_logo.png"
              alt="BlockQuest Logo"
              style={{ width: 72, height: 72, objectFit: "contain" }}
            />
          </div>
          <h1>Admin Portal</h1>
          <p className="admin-login-hint">Enter your admin password to access the dashboard.</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-login-input"
              autoFocus
            />
            {authError && <p className="admin-error-msg">{authError}</p>}
            <button type="submit" className="admin-login-btn">
              Unlock Dashboard →
            </button>
          </form>
          <Link href="/" className="admin-back-link">← Back to Home Portal</Link>
        </div>
      </main>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────
  return (
    <main className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header__brand">
          <img
            src="https://block-quest.com/assets/images/block_quest_logo.png"
            alt="BlockQuest Logo"
            style={{ width: 40, height: 40, objectFit: "contain" }}
          />
          <div>
            <p className="admin-header__eyebrow">BlockQuest Fiesta PH</p>
            <h1 className="admin-header__title">Admin Dashboard</h1>
          </div>
        </div>
        <div className="admin-header__actions">
          <Link href="/" className="admin-nav-link">Home Portal</Link>
          <Link href="/register" className="admin-nav-link">Registration</Link>
          <Link href="/zealy" className="admin-nav-link">Quest Game</Link>
        </div>
      </header>

      {/* Stat Cards */}
      <section className="admin-stats">
        <div className="admin-stat-card">
          <span className="admin-stat-card__icon">🎫</span>
          <div>
            <p className="admin-stat-card__label">Total Attendees</p>
            <p className="admin-stat-card__value">{attendees.length}</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__icon">⚡</span>
          <div>
            <p className="admin-stat-card__label">Live Quests</p>
            <p className="admin-stat-card__value">{liveQuestCount}</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__icon">🏆</span>
          <div>
            <p className="admin-stat-card__label">Total XP Pool</p>
            <p className="admin-stat-card__value">{totalXpPool.toLocaleString()} XP</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__icon">📋</span>
          <div>
            <p className="admin-stat-card__label">Total Quests</p>
            <p className="admin-stat-card__value">{quests.length}</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__icon">✅</span>
          <div>
            <p className="admin-stat-card__label">Checked In</p>
            <p className="admin-stat-card__value">{attendees.filter((a: any) => a.checked_in).length}</p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="admin-tabs">
        {ADMIN_TABS.map((t) => (
          <button
            key={t}
            className={`admin-tab-btn${tab === t ? " admin-tab-btn--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "scanner"
              ? "📷 QR Scanner"
              : t === "attendees"
              ? "🎫 Event Pass Attendees"
              : t === "quests"
              ? "⚡ Fiesta Event Quests"
              : `🔍 Quest Verifications (${verifications.filter((v) => v.status === "Pending").length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <section className="admin-content">
        {loading && tab !== "scanner" && <p className="admin-loading">Loading…</p>}
        {error && tab !== "scanner" && <p className="admin-error-msg" style={{ marginBottom: 16 }}>{error}</p>}

        {/* ─── SCANNER TAB ─── */}
        {tab === "scanner" && <QrScanner />}

        {/* ─── ATTENDEES TAB ─── */}
        {tab === "attendees" && !loading && (
          <>
            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <input
                type="search"
                placeholder="Search by name, email, ticket code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
                style={{ flex: "1 1 220px", minWidth: 200 }}
              />
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer" }}
              >
                <option value="all">All Statuses ({attendees.length})</option>
                <option value="checked">Checked In ({attendees.filter((a) => a.checked_in).length})</option>
                <option value="pending">Pending ({attendees.filter((a) => !a.checked_in).length})</option>
              </select>

              <span className="admin-toolbar__count" style={{ marginLeft: "auto" }}>
                Showing {filteredAttendees.length} of {attendees.length}
              </span>

              <button
                className={`admin-refresh-btn ${autoRefresh ? "admin-refresh-btn--active" : ""}`}
                onClick={() => setAutoRefresh((prev) => !prev)}
                title="Toggle 10s auto refresh"
                style={{
                  borderColor: autoRefresh ? "rgba(245,166,35,0.6)" : undefined,
                  color: autoRefresh ? "var(--gold-light)" : undefined,
                }}
              >
                {autoRefresh ? "⏱️ Auto (10s On)" : "⏱️ Auto (Off)"}
              </button>

              <button className="admin-refresh-btn" onClick={fetchAttendees} title="Refresh Now">
                ↻ Refresh
              </button>

              <button
                className="admin-add-btn"
                onClick={exportToCSV}
                title="Download CSV export"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff" }}
              >
                📥 Export CSV
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Organization</th>
                    <th>Ticket Code</th>
                    <th>Check-in Status</th>
                    <th>Registered</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="admin-table__empty">
                        {search || statusFilter !== "all"
                          ? "No matching attendees found."
                          : "No registrations yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((a, i) => (
                      <tr key={a.id} className="admin-table__row">
                        <td className="admin-table__num">{i + 1}</td>
                        <td className="admin-table__name">{a.full_name}</td>
                        <td className="admin-table__email">{a.email}</td>
                        <td>{a.phone}</td>
                        <td>{a.organization || <span className="admin-table__muted">—</span>}</td>
                        <td>
                          {a.ticket_code ? (
                            <button
                              className="admin-ticket-code-btn"
                              onClick={() => copyTicket(a)}
                              title="Click to copy ticket code"
                            >
                              {a.ticket_code}
                              <span className="admin-ticket-code-btn__copy">
                                {copiedId === a.id ? "✓" : "⧉"}
                              </span>
                            </button>
                          ) : (
                            <span className="admin-table__muted">—</span>
                          )}
                        </td>
                        <td>
                          {a.checked_in ? (
                            <span
                              className="admin-status-badge admin-status-badge--live"
                              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}
                              title={a.checked_in_at ? `Checked in at ${new Date(a.checked_in_at).toLocaleString()}` : "Checked in"}
                            >
                              ✓ Checked In
                            </span>
                          ) : (
                            <span
                              className="admin-status-badge admin-status-badge--soon"
                              style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.3)" }}
                            >
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                        <td className="admin-table__muted">
                          {new Date(a.created_at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td>
                          {a.checked_in ? (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Done</span>
                          ) : (
                            <button
                              className="admin-edit-btn"
                              onClick={() => handleManualCheckIn(a)}
                              disabled={checkingInId === a.id || !a.ticket_code}
                              style={{
                                background: "rgba(16, 185, 129, 0.2)",
                                borderColor: "rgba(16, 185, 129, 0.4)",
                                color: "#34d399",
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                              }}
                            >
                              {checkingInId === a.id ? "Checking..." : "Check In"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── QUESTS TAB ─── */}
        {tab === "quests" && !loading && (
          <>
            <div className="admin-toolbar">
              <span className="admin-toolbar__count">{quests.length} quests total</span>
              <button className="admin-refresh-btn" onClick={fetchQuests} title="Refresh">
                ↻ Refresh
              </button>
              <button className="admin-add-btn" onClick={openAddQuest}>
                + Add Quest
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>XP</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-table__empty">
                        No quests yet. Add one!
                      </td>
                    </tr>
                  ) : (
                    quests.map((q) => (
                      <tr key={q.id} className="admin-table__row">
                        <td className="admin-table__num">{q.sort_order}</td>
                        <td>
                          <code className="admin-quest-id">{q.id}</code>
                        </td>
                        <td className="admin-table__name">{q.title}</td>
                        <td>
                          <span className={`admin-category-badge admin-category-badge--${q.category}`}>
                            {q.category}
                          </span>
                        </td>
                        <td>
                          <span className="admin-xp-badge">+{q.xp} XP</span>
                        </td>
                        <td>
                          <button
                            className={`admin-status-badge admin-status-badge--${q.status.toLowerCase()}`}
                            onClick={() => toggleStatus(q)}
                            title="Click to cycle status"
                          >
                            {q.status}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {q.status === "Draft" && (
                              <button
                                className="admin-edit-btn"
                                onClick={() => publishQuest(q)}
                                style={{ background: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.4)", color: "#34d399", fontWeight: 800 }}
                                title="Publish this quest so players can see it"
                              >
                                🚀 Publish
                              </button>
                            )}
                            <button className="admin-edit-btn" onClick={() => openEditQuest(q)}>
                              Edit
                            </button>
                            <button className="admin-delete-btn" onClick={() => deleteQuest(q.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── VERIFICATIONS TAB ─── */}
        {tab === "verifications" && !loading && (
          <>
            <div className="admin-toolbar">
              <span className="admin-toolbar__count">
                {verifications.filter((v) => v.status === "Pending").length} pending verifications
              </span>
              <button className="admin-refresh-btn" onClick={fetchVerifications} title="Refresh">
                ↻ Refresh
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Quester / Attendee</th>
                    <th>Quest Title</th>
                    <th>Reward</th>
                    <th>Proof Screenshot</th>
                    <th>Submitted At</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="admin-table__empty">
                        No pending quest proof submissions.
                      </td>
                    </tr>
                  ) : (
                    verifications.map((v, i) => (
                      <tr key={v.id} className="admin-table__row">
                        <td className="admin-table__num">{i + 1}</td>
                        <td className="admin-table__name">
                          <strong>{v.user_name}</strong>
                          <br />
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{v.user_email}</span>
                          {v.ticket_code && (
                            <span style={{ fontSize: "0.72rem", color: "var(--gold-light)", display: "block" }}>
                              {v.ticket_code}
                            </span>
                          )}
                        </td>
                        <td className="admin-table__name">{v.quest_title}</td>
                        <td>
                          <span className="admin-xp-badge">+{v.xp} XP</span>
                        </td>
                        <td>
                          {v.proof_url ? (
                            <div
                              onClick={() => setSelectedProofImage(v.proof_url)}
                              style={{ cursor: "pointer", display: "inline-block" }}
                              title="Click to view full screenshot proof"
                            >
                              <img
                                src={v.proof_url}
                                alt="Proof thumbnail"
                                style={{
                                  width: 54,
                                  height: 54,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border: "1px solid rgba(245, 166, 35, 0.5)",
                                }}
                              />
                            </div>
                          ) : (
                            <span className="admin-table__muted">No image</span>
                          )}
                        </td>
                        <td className="admin-table__muted">
                          {new Date(v.created_at).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          {v.status === "Approved" ? (
                            <span className="admin-status-badge admin-status-badge--live">✓ Approved</span>
                          ) : v.status === "Rejected" ? (
                            <span className="admin-status-badge admin-status-badge--done" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                              ✕ Rejected
                            </span>
                          ) : (
                            <span className="admin-status-badge admin-status-badge--soon">⏳ Pending</span>
                          )}
                        </td>
                        <td>
                          {v.status === "Pending" ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                className="admin-edit-btn"
                                onClick={() => handleVerifyQuest(v.id, "Approved")}
                                style={{ background: "rgba(16, 185, 129, 0.2)", borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399" }}
                              >
                                ✓ Verify
                              </button>
                              <button
                                className="admin-delete-btn"
                                onClick={() => handleVerifyQuest(v.id, "Rejected")}
                                style={{ background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ─── QUEST MODAL (Redesigned with Live Preview) ─── */}
      {showQuestModal && (
        <div className="admin-modal-overlay" onClick={() => setShowQuestModal(false)}>
          <div className="quest-modal-wide" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="quest-modal-header">
              <div className="quest-modal-header__title">
                <span className="quest-modal-header__icon">{editingQuest ? "✏️" : "⚡"}</span>
                <div>
                  <h2>{editingQuest ? "Edit Quest" : "Create New Quest"}</h2>
                  <p>Fill in the form — the preview card updates in real time.</p>
                </div>
              </div>
              <button className="admin-modal__close" onClick={() => setShowQuestModal(false)}>✕</button>
            </div>

            {/* Two-panel body */}
            <div className="quest-modal-body">

              {/* LEFT: Form */}
              <form onSubmit={saveQuest} className="quest-form-panel">

                {/* ① Identity */}
                <div className="qf-section">
                  <div className="qf-section__label">① Identity</div>
                  <div className="admin-form-row" style={{ gridTemplateColumns: "1fr 90px" }}>
                    <label className="qf-label">
                      Quest ID *
                      <input
                        type="text"
                        value={questForm.id}
                        onChange={(e) => setQuestForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                        placeholder="e.g. follow-x"
                        required
                        disabled={!!editingQuest}
                        className="qf-input"
                      />
                      <small>Auto-slugged · cannot change after creation</small>
                    </label>
                    <label className="qf-label">
                      Order
                      <input
                        type="number"
                        value={questForm.sort_order}
                        onChange={(e) => setQuestForm((f) => ({ ...f, sort_order: +e.target.value }))}
                        min={1}
                        className="qf-input"
                      />
                    </label>
                  </div>
                </div>

                {/* ② Content */}
                <div className="qf-section">
                  <div className="qf-section__label">② Content</div>
                  <label className="qf-label">
                    Quest Title *
                    <input
                      type="text"
                      value={questForm.title}
                      onChange={(e) => setQuestForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Follow @BlockQuest on X"
                      required
                      className="qf-input"
                    />
                  </label>
                  <label className="qf-label" style={{ marginTop: 10 }}>
                    Description <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.75rem", color: "#64748b" }}>(optional)</span>
                    <textarea
                      value={questForm.description ?? ""}
                      onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Short instructions for players…"
                      rows={2}
                      className="qf-input"
                    />
                  </label>
                </div>

                {/* ③ Settings */}
                <div className="qf-section">
                  <div className="qf-section__label">③ Settings</div>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, marginBottom: 12 }}>
                    <label className="qf-label">
                      XP Reward
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          value={questForm.xp}
                          onChange={(e) => setQuestForm((f) => ({ ...f, xp: +e.target.value }))}
                          min={0}
                          step={10}
                          className="qf-input"
                          style={{ paddingLeft: 34 }}
                        />
                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#f5a623", fontWeight: 800 }}>⚡</span>
                      </div>
                    </label>
                    <label className="qf-label">
                      Status
                      <div className="qf-pill-group">
                        {(["Live", "Soon", "Done", "Draft"] as Quest["status"][]).map((s) => (
                          <button key={s} type="button"
                            onClick={() => setQuestForm((f) => ({ ...f, status: s }))}
                            className={`qf-pill qf-pill--${s.toLowerCase()}${questForm.status === s ? " qf-pill--active" : ""}`}
                          >
                            {s === "Live" ? "🟢" : s === "Soon" ? "🔜" : s === "Draft" ? "📝" : "✅"} {s}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                  <label className="qf-label">
                    Category
                    <div className="qf-pill-group">
                      {(["onboarding", "social", "daily"] as Quest["category"][]).map((c) => (
                        <button key={c} type="button"
                          onClick={() => setQuestForm((f) => ({ ...f, category: c }))}
                          className={`qf-pill${questForm.category === c ? " qf-pill--active" : ""}`}
                        >
                          {c === "onboarding" ? "🚀" : c === "social" ? "📣" : "📅"} {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                {/* ④ Action link */}
                <div className="qf-section">
                  <div className="qf-section__label">④ Action Button <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.75rem", color: "#64748b" }}>(optional)</span></div>
                  <div className="admin-form-row">
                    <label className="qf-label">
                      Button Label
                      <input type="text" value={questForm.action_label ?? ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, action_label: e.target.value }))}
                        placeholder="e.g. Register now" className="qf-input" />
                    </label>
                    <label className="qf-label">
                      Button URL
                      <input type="text" value={questForm.action_url ?? ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, action_url: e.target.value }))}
                        placeholder="/register or https://x.com" className="qf-input" />
                    </label>
                  </div>
                </div>

                {/* ⑤ Verification */}
                <div className="qf-section">
                  <div className="qf-section__label">⑤ Verification Mode</div>
                  <button
                    type="button"
                    onClick={() => setQuestForm((f) => ({ ...f, requires_proof: !f.requires_proof }))}
                    className={`qf-proof-toggle${questForm.requires_proof ? " qf-proof-toggle--on" : ""}`}
                  >
                    <span className="qf-proof-toggle__icon">{questForm.requires_proof ? "📷" : "⚡"}</span>
                    <div className="qf-proof-toggle__text">
                      <strong>{questForm.requires_proof ? "Screenshot Proof Required" : "Instant Claim (No Proof)"}</strong>
                      <span>{questForm.requires_proof
                        ? "Players upload a screenshot. Admin reviews before XP is awarded."
                        : "Players claim XP instantly. Click to require screenshot proof."}</span>
                    </div>
                    <div className={`qf-proof-toggle__switch${questForm.requires_proof ? " qf-proof-toggle__switch--on" : ""}`}>
                      <div className="qf-proof-toggle__knob" />
                    </div>
                  </button>
                </div>

                {questError && <p className="admin-error-msg">{questError}</p>}

                <div className="quest-modal-footer">
                  <button type="button" className="admin-cancel-btn" onClick={() => setShowQuestModal(false)}>Cancel</button>
                  {!editingQuest && (
                    <button
                      type="button"
                      className="admin-cancel-btn qf-draft-btn"
                      onClick={saveDraftQuest}
                      disabled={questSaving}
                      title="Save quest as Draft — hidden from players until you publish it"
                    >
                      {questSaving ? "Saving…" : "📝 Save as Draft"}
                    </button>
                  )}
                  <button type="submit" className="admin-save-btn" disabled={questSaving}>
                    {questSaving ? "Saving…" : editingQuest
                      ? (editingQuest.status === "Draft" ? "🚀 Publish Quest" : "💾 Save Changes")
                      : "⚡ Create Quest"}
                  </button>
                </div>
              </form>

              {/* RIGHT: Live Preview */}
              <div className="quest-preview-panel">
                <div className="quest-preview-panel__label">👁 Live Preview</div>
                <div className="quest-preview-card">
                  <div className="quest-preview-card__top">
                    <div className="quest-preview-card__badges">
                      <span className={`quest-preview-badge quest-preview-badge--${questForm.category || "onboarding"}`}>
                        {questForm.category === "social" ? "📣" : questForm.category === "daily" ? "📅" : "🚀"}
                        {" "}{(questForm.category || "onboarding").charAt(0).toUpperCase() + (questForm.category || "onboarding").slice(1)}
                      </span>
                      {questForm.requires_proof && (
                        <span className="quest-preview-badge quest-preview-badge--proof">📷 Proof</span>
                      )}
                    </div>
                    <span className={`quest-preview-status quest-preview-status--${(questForm.status || "draft").toLowerCase()}`}>
                      {questForm.status === "Live" ? "🟢 Live"
                        : questForm.status === "Done" ? "✅ Done"
                        : questForm.status === "Draft" ? "📝 Draft"
                        : "🔜 Soon"}
                    </span>
                  </div>

                  <div className="quest-preview-card__title">
                    {questForm.title || <span style={{ color: "#64748b", fontStyle: "italic" }}>Quest title will appear here…</span>}
                  </div>

                  {questForm.description && (
                    <div className="quest-preview-card__desc">{questForm.description}</div>
                  )}

                  <div className="quest-preview-card__footer">
                    <div className="quest-preview-xp">
                      <span>⚡</span>
                      <span className="quest-preview-xp__value">{questForm.xp || 0} XP</span>
                    </div>
                    {questForm.action_label ? (
                      <button className="quest-preview-action-btn" disabled>{questForm.action_label}</button>
                    ) : (
                      <button className={`quest-preview-claim-btn${questForm.requires_proof ? " quest-preview-claim-btn--proof" : ""}`} disabled>
                        {questForm.requires_proof ? "📷 Upload Proof" : "⚡ Claim XP"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="quest-preview-meta">
                  <div className="quest-preview-meta__row">
                    <span>Quest ID</span><code>{questForm.id || "—"}</code>
                  </div>
                  <div className="quest-preview-meta__row">
                    <span>Sort Order</span><code>#{questForm.sort_order}</code>
                  </div>
                  {questForm.action_url && (
                    <div className="quest-preview-meta__row">
                      <span>URL</span>
                      <code style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{questForm.action_url}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Proof Fullscreen Image Modal */}
      {selectedProofImage && (
        <div
          className="admin-modal-overlay"
          onClick={() => setSelectedProofImage(null)}
          style={{ zIndex: 1000, background: "rgba(0,0,0,0.85)" }}
        >
          <div
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedProofImage}
              alt="Proof Full Resolution"
              style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, border: "2px solid rgba(245,166,35,0.6)", boxShadow: "0 0 40px rgba(0,0,0,0.8)" }}
            />
            <button
              className="admin-cancel-btn"
              onClick={() => setSelectedProofImage(null)}
              style={{ marginTop: 16, padding: "8px 24px", background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
