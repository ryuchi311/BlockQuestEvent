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
  created_at: string;
}

interface Quest {
  id: string;
  title: string;
  description: string | null;
  xp: number;
  status: "Live" | "Soon" | "Done";
  category: "onboarding" | "social" | "daily";
  action_label: string | null;
  action_url: string | null;
  sort_order: number;
}

const ADMIN_TABS = ["scanner", "attendees", "quests"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const STATUS_OPTIONS: Quest["status"][] = ["Live", "Soon", "Done"];
const CATEGORY_OPTIONS: Quest["category"][] = ["onboarding", "social", "daily"];

const EMPTY_QUEST: Omit<Quest, "created_at" | "updated_at"> = {
  id: "",
  title: "",
  description: "",
  xp: 100,
  status: "Soon",
  category: "onboarding",
  action_label: "",
  action_url: "",
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Attendee search ──
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    if (!authed) return;
    if (tab === "attendees") fetchAttendees();
    else fetchQuests();
  }, [authed, tab, fetchAttendees, fetchQuests]);

  // ─── Attendee helpers ────────────────────────────────────────────────────
  const filteredAttendees = attendees.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.ticket_code ?? "").toLowerCase().includes(q) ||
      (a.organization ?? "").toLowerCase().includes(q)
    );
  });

  function copyTicket(attendee: Attendee) {
    navigator.clipboard.writeText(attendee.ticket_code ?? "");
    setCopiedId(attendee.id);
    setTimeout(() => setCopiedId(null), 2000);
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
      Live: "Soon",
      Soon: "Done",
      Done: "Live",
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
            {t === "scanner" ? "📷 QR Scanner" : t === "attendees" ? "🎫 Event Pass Attendees" : "⚡ Fiesta Event Quests"}
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
            <div className="admin-toolbar">
              <input
                type="search"
                placeholder="Search by name, email, ticket code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
              />
              <span className="admin-toolbar__count">
                {filteredAttendees.length} of {attendees.length} attendees
              </span>
              <button className="admin-refresh-btn" onClick={fetchAttendees} title="Refresh">
                ↻ Refresh
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
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-table__empty">
                        {search ? "No matching attendees found." : "No registrations yet."}
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
                              title="Click to copy"
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
                        <td className="admin-table__muted">
                          {new Date(a.created_at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
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
                          <div style={{ display: "flex", gap: 8 }}>
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
      </section>

      {/* ─── QUEST MODAL ─── */}
      {showQuestModal && (
        <div className="admin-modal-overlay" onClick={() => setShowQuestModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h2>{editingQuest ? "Edit Quest" : "Add New Quest"}</h2>
              <button className="admin-modal__close" onClick={() => setShowQuestModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={saveQuest} className="admin-quest-form">
              <div className="admin-form-row">
                <label>
                  Quest ID *
                  <input
                    type="text"
                    value={questForm.id}
                    onChange={(e) => setQuestForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="e.g. follow-x"
                    required
                    disabled={!!editingQuest}
                  />
                  <small>Unique slug. Cannot be changed after creation.</small>
                </label>
                <label>
                  Sort Order
                  <input
                    type="number"
                    value={questForm.sort_order}
                    onChange={(e) => setQuestForm((f) => ({ ...f, sort_order: +e.target.value }))}
                    min={1}
                  />
                </label>
              </div>

              <label>
                Title *
                <input
                  type="text"
                  value={questForm.title}
                  onChange={(e) => setQuestForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Quest title shown to players"
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  value={questForm.description ?? ""}
                  onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to players"
                  rows={3}
                />
              </label>

              <div className="admin-form-row">
                <label>
                  XP Reward
                  <input
                    type="number"
                    value={questForm.xp}
                    onChange={(e) => setQuestForm((f) => ({ ...f, xp: +e.target.value }))}
                    min={0}
                    step={10}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={questForm.status}
                    onChange={(e) => setQuestForm((f) => ({ ...f, status: e.target.value as Quest["status"] }))}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={questForm.category}
                    onChange={(e) => setQuestForm((f) => ({ ...f, category: e.target.value as Quest["category"] }))}
                  >
                    {CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <div className="admin-form-row">
                <label>
                  Action Label
                  <input
                    type="text"
                    value={questForm.action_label ?? ""}
                    onChange={(e) => setQuestForm((f) => ({ ...f, action_label: e.target.value }))}
                    placeholder="e.g. Register now"
                  />
                </label>
                <label>
                  Action URL
                  <input
                    type="text"
                    value={questForm.action_url ?? ""}
                    onChange={(e) => setQuestForm((f) => ({ ...f, action_url: e.target.value }))}
                    placeholder="e.g. /register or https://x.com"
                  />
                </label>
              </div>

              {questError && <p className="admin-error-msg">{questError}</p>}

              <div className="admin-modal__footer">
                <button type="button" className="admin-cancel-btn" onClick={() => setShowQuestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-save-btn" disabled={questSaving}>
                  {questSaving ? "Saving…" : editingQuest ? "Save Changes" : "Create Quest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
