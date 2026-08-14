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
  rejection_reason?: string | null;
  created_at: string;
}

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
}


const ADMIN_TABS = ["scanner", "attendees", "quests", "verifications", "socials", "booths", "staff"] as const;
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
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // ── Session persistence & Idle Timeout ──
  useEffect(() => {
    setMounted(true);
    // Restore authenticated session from sessionStorage (auto-cleared when browser/tab closes)
    const savedSession = sessionStorage.getItem("blockquest_admin_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.authed && session.adminUser) {
          setAuthed(true);
          setAdminUser(session.adminUser);
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert("Your session has expired due to 5 minutes of inactivity.");
        handleLogout();
      }, 300000); // 5 minutes
    };
    resetTimer();
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [authed]);

  // ── Tabs & data ──
  const [tab, setTab] = useState<AdminTab>("attendees");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [verifications, setVerifications] = useState<QuestVerification[]>([]);
  const [selectedProofImage, setSelectedProofImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  function resetZoom() {
    setZoomScale(1);
    setZoomPos({ x: 0, y: 0 });
  }

  function handleWheelZoom(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomScale((prev) => {
      const next = Math.min(Math.max(prev + delta, 0.5), 4);
      if (next === 1) setZoomPos({ x: 0, y: 0 });
      return next;
    });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomPos.x, y: e.clientY - zoomPos.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || zoomScale <= 1) return;
    setZoomPos({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Attendee search & filter ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked" | "pending">("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // ── Quest search & filter ──
  const [questSearch, setQuestSearch] = useState("");
  const [questStatusFilter, setQuestStatusFilter] = useState<"all" | Quest["status"]>("all");
  const [questCategoryFilter, setQuestCategoryFilter] = useState<"all" | Quest["category"]>("all");

  // ── Verification search & filter ──
  const [verificationSearch, setVerificationSearch] = useState("");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<"all" | QuestVerification["status"]>("all");

  // ── Quest modal ──
  const DRAFT_KEY = "blockquest_quest_draft";
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [questForm, setQuestForm] = useState<typeof EMPTY_QUEST>({ ...EMPTY_QUEST });
  const [questSaving, setQuestSaving] = useState(false);
  const [questError, setQuestError] = useState("");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [statusModalQuest, setStatusModalQuest] = useState<Quest | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ── Staff (Superadmin only) ──
  const [adminUsersList, setAdminUsersList] = useState<any[]>([]);
  const [newAdminForm, setNewAdminForm] = useState({ email: "", password: "", full_name: "", role: "verifier" });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState<any | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({ id: 0, email: "", password: "", full_name: "", role: "verifier" });
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [deletingAdminUser, setDeletingAdminUser] = useState<any | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [checkInConfirmAttendee, setCheckInConfirmAttendee] = useState<Attendee | null>(null);

  // ── Booths / Vendors (Superadmin only) ──
  const [boothList, setBoothList] = useState<any[]>([
    { id: "polygon-guild", name: "Polygon Guild Booth", points: 150, email: "booth.polygon@blockquest.ph" },
    { id: "solana-superteam", name: "Solana Superteam PH", points: 150, email: "booth.solana@blockquest.ph" },
    { id: "binance-academy", name: "Binance Academy Booth", points: 150, email: "booth.binance@blockquest.ph" },
    { id: "base-hub", name: "Base Ecosystem Hub", points: 150, email: "booth.base@blockquest.ph" },
    { id: "trezor-ledger", name: "Trezor & Ledger Hardware", points: 200, email: "booth.trezor@blockquest.ph" },
    { id: "gaming-arena", name: "Web3 Gaming Arena", points: 200, email: "booth.gaming@blockquest.ph" },
    { id: "tamago-lounge", name: "BRGY Tamago Lounge", points: 100, email: "booth.tamago@blockquest.ph" },
  ]);
  const [newBoothForm, setNewBoothForm] = useState({ name: "", email: "", password: "", points: 150 });
  const [isCreatingBooth, setIsCreatingBooth] = useState(false);
  const [showAddBoothModal, setShowAddBoothModal] = useState(false);

  const [editingBooth, setEditingBooth] = useState<any | null>(null);
  const [editBoothForm, setEditBoothForm] = useState({ id: 0, name: "", email: "", password: "", points: 150 });
  const [isUpdatingBooth, setIsUpdatingBooth] = useState(false);

  // ── Social Missions (Superadmin only) ──
  const [socialMissions, setSocialMissions] = useState<any[]>([]);
  const [newSocialMissionForm, setNewSocialMissionForm] = useState({ platform: "facebook", title: "", description: "", url: "", button_text: "", button_color: "#1877f2", sort_order: 0 });
  const [isCreatingMission, setIsCreatingMission] = useState(false);
  const [showAddMissionModal, setShowAddMissionModal] = useState(false);

  // ── Copy tooltip ──
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ─── Auth ────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      setAdminUser(json.adminUser);
      setAuthed(true);
      sessionStorage.setItem("blockquest_admin_session", JSON.stringify({
        authed: true,
        adminUser: json.adminUser
      }));
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    setAuthed(false);
    setAdminUser(null);
    setPassword("");
    setEmail("");
    setTab("attendees");
    setAttendees([]);
    setQuests([]);
    setVerifications([]);
    setError("");
    sessionStorage.removeItem("blockquest_admin_session");
  }

  // Set default accessible tab based on role when logging in
  useEffect(() => {
    if (!adminUser) return;
    const role = adminUser.role;
    if (role === "verifier" && tab !== "verifications") {
      setTab("verifications");
    } else if ((role === "manage_attendees" || role === "manage_quester") && tab !== "scanner" && tab !== "attendees") {
      setTab("scanner");
    } else if ((role === "admin" || role === "viewer") && (tab === "staff" || tab === "socials")) {
      setTab("attendees");
    }
  }, [adminUser]);

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

  const fetchAdminUsers = useCallback(async () => {
    if (adminUser?.role !== "superadmin" && adminUser?.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load admin users.");
      setAdminUsersList(json.adminUsers ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  const fetchSocialMissions = useCallback(async () => {
    if (adminUser?.role !== "superadmin") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/social-missions");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load social missions.");
      setSocialMissions(json.missions ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  // Load ALL data immediately on auth so stat cards are always accurate
  useEffect(() => {
    if (!authed) return;
    fetchAttendees();
    fetchQuests();
    fetchVerifications();
  }, [authed, fetchAttendees, fetchQuests, fetchVerifications]);

  // Refresh current tab data when switching tabs
  useEffect(() => {
    if (!authed) return;
    if (tab === "attendees") fetchAttendees();
    else if (tab === "quests") fetchQuests();
    else if (tab === "verifications") fetchVerifications();
    else if (tab === "staff") fetchAdminUsers();
    else if (tab === "socials") fetchSocialMissions();
  }, [tab, fetchAttendees, fetchQuests, fetchVerifications, fetchAdminUsers, fetchSocialMissions]);

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

  const [rejectingItem, setRejectingItem] = useState<QuestVerification | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const [deletingQuestId, setDeletingQuestId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleVerifyQuest(id: number, newStatus: "Approved" | "Rejected", reason?: string) {
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, rejection_reason: reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update verification.");
      setVerifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus, rejection_reason: reason || null } : item))
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

  // ─── Quest helpers ───────────────────────────────────────────────────────
  const filteredQuests = quests.filter((q) => {
    const query = questSearch.toLowerCase();
    const matchesQuery =
      !query ||
      q.title.toLowerCase().includes(query) ||
      q.id.toLowerCase().includes(query) ||
      (q.description ?? "").toLowerCase().includes(query) ||
      q.category.toLowerCase().includes(query);

    if (!matchesQuery) return false;
    if (questStatusFilter !== "all" && q.status !== questStatusFilter) return false;
    if (questCategoryFilter !== "all" && q.category !== questCategoryFilter) return false;
    return true;
  });

  // ─── Verification helpers ────────────────────────────────────────────────
  const filteredVerifications = verifications.filter((v) => {
    const query = verificationSearch.toLowerCase();
    const matchesQuery =
      !query ||
      v.user_name.toLowerCase().includes(query) ||
      v.user_email.toLowerCase().includes(query) ||
      v.quest_title.toLowerCase().includes(query) ||
      v.quest_id.toLowerCase().includes(query) ||
      (v.ticket_code ?? "").toLowerCase().includes(query);

    if (!matchesQuery) return false;
    if (verificationStatusFilter !== "all" && v.status !== verificationStatusFilter) return false;
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
      setCheckInConfirmAttendee(null);
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
    setQuestError("");
    // Check for an existing auto-saved draft
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        // Only restore if there's meaningful content
        if (draft.title || draft.id) {
          setQuestForm(draft);
          setHasSavedDraft(true);
          setShowQuestModal(true);
          return;
        }
      }
    } catch {}
    setHasSavedDraft(false);
    setQuestForm({ ...EMPTY_QUEST });
    setShowQuestModal(true);
  }

  function closeModal() {
    // If creating (not editing) and form has meaningful content, auto-save draft
    if (!editingQuest) {
      const hasContent = questForm.title.trim() || questForm.id.trim();
      if (hasContent) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(questForm));
        } catch {}
      }
    }
    setShowQuestModal(false);
  }

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasSavedDraft(false);
    setQuestForm({ ...EMPTY_QUEST });
  }

  function resumeDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setQuestForm(JSON.parse(raw));
    } catch {}
    setHasSavedDraft(false);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasSavedDraft(false);
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
    setHasSavedDraft(false);
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
      clearDraft();
      setShowQuestModal(false);
      fetchQuests();
    } catch (err: any) {
      setQuestError(err.message);
    } finally {
      setQuestSaving(false);
    }
  }

  function confirmDeleteQuest(id: string) {
    setDeletingQuestId(id);
    setDeleteConfirmation("");
  }

  async function executeDeleteQuest() {
    if (!deletingQuestId) return;
    if (deleteConfirmation !== deletingQuestId) {
      alert("ID does not match.");
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/quests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingQuestId }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error);
      }
      setQuests((prev) => prev.filter((q) => q.id !== deletingQuestId));
      setDeletingQuestId(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateQuestStatus(newStatus: Quest["status"]) {
    if (!statusModalQuest) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch("/api/admin/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: statusModalQuest.id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      setQuests((prev) => prev.map((q) => (q.id === statusModalQuest.id ? { ...q, status: newStatus } : q)));
      setStatusModalQuest(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
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
      clearDraft();
      setShowQuestModal(false);
      fetchQuests();
    } catch (err: any) {
      setQuestError(err.message);
    } finally {
      setQuestSaving(false);
    }
  }

  // ─── Staff Helpers ───────────────────────────────────────────────────────
  function handleOpenEditAdmin(user: any) {
    setEditingAdminUser(user);
    setEditAdminForm({
      id: user.id,
      email: user.email,
      password: "", // empty means keep existing password
      full_name: user.full_name,
      role: user.role,
    });
  }

  async function handleUpdateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdminForm.id) return;
    setIsUpdatingAdmin(true);
    try {
      const payload: Record<string, any> = {
        id: editAdminForm.id,
        full_name: editAdminForm.full_name,
        email: editAdminForm.email,
        role: editAdminForm.role,
      };
      if (editAdminForm.password && editAdminForm.password.trim().length > 0) {
        payload.password = editAdminForm.password;
      }

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update admin");

      setAdminUsersList(prev =>
        prev.map(u => (u.id === json.adminUser.id ? json.adminUser : u))
      );

      // If the current superadmin edited their own profile info, update adminUser state & localStorage
      if (adminUser && adminUser.id === json.adminUser.id) {
        const updatedSelf = { ...adminUser, ...json.adminUser };
        setAdminUser(updatedSelf);
        localStorage.setItem(
          "blockquest_admin_session",
          JSON.stringify({ authed: true, adminUser: updatedSelf })
        );
      }

      setEditingAdminUser(null);
      alert("Admin updated successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingAdmin(false);
    }
  }

  async function handleCreateBoothStation(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingBooth(true);
    try {
      // 1. Create admin user with booth_staff role
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newBoothForm.email,
          password: newBoothForm.password,
          full_name: newBoothForm.name,
          role: "booth_staff",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create booth account");

      const newId = newBoothForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setBoothList(prev => [
        { id: newId, name: newBoothForm.name, points: newBoothForm.points, email: newBoothForm.email },
        ...prev
      ]);
      setNewBoothForm({ name: "", email: "", password: "", points: 150 });
      setShowAddBoothModal(false);
      alert(`Booth station "${newBoothForm.name}" created successfully! Login: ${newBoothForm.email}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsCreatingBooth(false);
    }
  }

  function handleOpenEditBooth(booth: any) {
    setEditingBooth(booth);
    setEditBoothForm({
      id: booth.id,
      name: booth.name || "",
      email: booth.email || "",
      password: "",
      points: booth.points || 150,
    });
  }

  async function handleUpdateBoothStation(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBooth) return;
    setIsUpdatingBooth(true);

    try {
      if (editingBooth.isDb) {
        // Update database admin user record
        const payload: any = {
          id: editBoothForm.id,
          full_name: editBoothForm.name,
          email: editBoothForm.email,
        };
        if (editBoothForm.password.trim()) {
          payload.password = editBoothForm.password.trim();
        }

        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update booth station");

        setAdminUsersList(prev => prev.map(u => u.id === editBoothForm.id ? { ...u, full_name: editBoothForm.name, email: editBoothForm.email } : u));
      }

      // Update local booth list points and details
      setBoothList(prev => prev.map(b => (b.id === editingBooth.id || b.email === editingBooth.email) ? { ...b, name: editBoothForm.name, email: editBoothForm.email, points: editBoothForm.points } : b));
      setEditingBooth(null);
      alert(`Booth "${editBoothForm.name}" updated successfully with ${editBoothForm.points} XP!`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingBooth(false);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingAdmin(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdminForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create admin");
      
      setAdminUsersList(prev => [json.adminUser, ...prev]);
      setNewAdminForm({ email: "", password: "", full_name: "", role: "verifier" });
      alert("Admin created successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsCreatingAdmin(false);
    }
  }

  async function executeDeleteAdmin() {
    if (!deletingAdminUser) return;
    setIsDeletingAdmin(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingAdminUser.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete admin");
      
      setAdminUsersList(prev => prev.filter(u => u.id !== deletingAdminUser.id));
      setDeletingAdminUser(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeletingAdmin(false);
    }
  }

  async function handleCreateSocialMission(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingMission(true);
    try {
      const res = await fetch("/api/admin/social-missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSocialMissionForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create social mission");
      
      setSocialMissions(prev => [...prev, json.mission]);
      setNewSocialMissionForm({ platform: "facebook", title: "", description: "", url: "", button_text: "", button_color: "#1877f2", sort_order: 0 });
      setShowAddMissionModal(false);
      alert("Social mission created successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsCreatingMission(false);
    }
  }

  async function handleDeleteSocialMission(id: number) {
    if (!window.confirm(`Are you sure you want to delete this social mission?`)) return;
    try {
      const res = await fetch("/api/admin/social-missions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete mission");
      
      setSocialMissions(prev => prev.filter(m => m.id !== id));
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
      <main className="admin-login-page" suppressHydrationWarning>
        <div className="admin-login-card" suppressHydrationWarning>
          <div className="admin-login-logo">
            <img
              src="https://block-quest.com/assets/images/block_quest_logo.png"
              alt="BlockQuest Logo"
              style={{ width: 72, height: 72, objectFit: "contain" }}
            />
          </div>
          <h1>Admin Portal</h1>
          <p className="admin-login-hint">Enter your admin credentials to access the dashboard.</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }} suppressHydrationWarning>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-login-input"
              required
              suppressHydrationWarning
            />
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-login-input"
              required
              suppressHydrationWarning
            />
            {authError && <p className="admin-error-msg">{authError}</p>}
            <button type="submit" className="admin-login-btn" disabled={loginLoading}>
              {loginLoading ? "Authenticating..." : "Unlock Dashboard →"}
            </button>
          </form>
          <Link href="/" className="admin-back-link">← Back to Home Portal</Link>
        </div>
      </main>
    );
  }

  function handleNavigate(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    if (window.confirm("Are you sure you want to leave the Admin Dashboard? Your session will be logged out.")) {
      handleLogout();
      window.location.href = href;
    }
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
          {adminUser && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 12 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#fff" }}>{adminUser.fullName}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--gold-light)", textTransform: "uppercase" }}>{adminUser.role}</span>
            </div>
          )}
          <a href="/" className="admin-nav-link" onClick={(e) => handleNavigate(e, "/")}>Home Portal</a>
          <a href="/register" className="admin-nav-link" onClick={(e) => handleNavigate(e, "/register")}>Registration</a>
          <a href="/zealy" className="admin-nav-link" onClick={(e) => handleNavigate(e, "/zealy")}>Quest Game</a>
          <button
            onClick={handleLogout}
            className="admin-nav-link"
            style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", background: "rgba(239,68,68,0.07)", cursor: "pointer" }}
          >
            🔓 Logout
          </button>
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
        <div className="admin-stat-card" style={{ borderLeft: "3px solid rgba(245, 158, 11, 0.7)" }}>
          <span className="admin-stat-card__icon">🔍</span>
          <div>
            <p className="admin-stat-card__label">Pending Reviews</p>
            <p
              className="admin-stat-card__value"
              style={{ color: verifications.filter((v) => v.status === "Pending").length > 0 ? "#f59e0b" : undefined }}
            >
              {verifications.filter((v) => v.status === "Pending").length}
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="admin-tabs">
        {ADMIN_TABS.filter((t) => {
          const role = adminUser?.role;
          if (role === "superadmin") return true;
          if (role === "verifier") return t === "verifications";
          if (role === "manage_attendees" || role === "manage_quester") return t === "scanner" || t === "attendees";
          if (role === "admin") return t === "scanner" || t === "attendees" || t === "quests" || t === "verifications" || t === "booths";
          if (role === "viewer") return t === "scanner" || t === "attendees" || t === "quests" || t === "verifications";
          return false;
        }).map((t) => (
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
              : t === "booths"
              ? "🏪 Booth Stations"
              : t === "staff"
              ? "🛡️ Staff / Admins"
              : t === "socials"
              ? "📣 Social Missions"
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

              {adminUser?.role === 'superadmin' && (
                <button
                  className="admin-add-btn"
                  onClick={exportToCSV}
                  title="Download CSV export"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff" }}
                >
                  📥 Export CSV
                </button>
              )}
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
                          ) : adminUser?.role === "viewer" ? (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Read-only</span>
                          ) : (
                            <button
                              className="admin-edit-btn"
                              onClick={() => setCheckInConfirmAttendee(a)}
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

            {/* Check-in Confirmation Modal */}
            {checkInConfirmAttendee && (
              <div className="admin-modal-overlay" onClick={() => setCheckInConfirmAttendee(null)}>
                <div className="quest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, padding: 24, textAlign: "center" }}>
                  <div className="quest-modal-header" style={{ justifyContent: "center" }}>
                    <h2>Confirm Check-in</h2>
                  </div>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: "0.95rem" }}>
                    Are you sure you want to manually check in <strong>{checkInConfirmAttendee.full_name}</strong>?
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button
                      className="admin-delete-btn"
                      onClick={() => setCheckInConfirmAttendee(null)}
                      style={{ padding: "8px 16px", background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      Cancel
                    </button>
                    <button
                      className="admin-edit-btn"
                      onClick={() => handleManualCheckIn(checkInConfirmAttendee)}
                      disabled={checkingInId === checkInConfirmAttendee.id}
                      style={{ padding: "8px 16px", background: "#10b981", color: "#fff", borderColor: "#059669", fontWeight: "bold" }}
                    >
                      {checkingInId === checkInConfirmAttendee.id ? "Checking in..." : "Yes, Check In"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── QUESTS TAB ─── */}
        {tab === "quests" && !loading && (
          <>
            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <input
                type="search"
                placeholder="Search quests by title, ID, category, description..."
                value={questSearch}
                onChange={(e) => setQuestSearch(e.target.value)}
                className="admin-search-input"
                style={{ flex: "1 1 220px", minWidth: 200 }}
              />

              <select
                value={questStatusFilter}
                onChange={(e) => setQuestStatusFilter(e.target.value as any)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer" }}
              >
                <option value="all">All Statuses ({quests.length})</option>
                <option value="Live">🟢 Live ({quests.filter((q) => q.status === "Live").length})</option>
                <option value="Soon">🔜 Soon ({quests.filter((q) => q.status === "Soon").length})</option>
                <option value="Draft">📝 Draft ({quests.filter((q) => q.status === "Draft").length})</option>
                <option value="Done">✅ Done ({quests.filter((q) => q.status === "Done").length})</option>
              </select>

              <select
                value={questCategoryFilter}
                onChange={(e) => setQuestCategoryFilter(e.target.value as any)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer" }}
              >
                <option value="all">All Categories</option>
                <option value="onboarding">🚀 Onboarding</option>
                <option value="social">📣 Social</option>
                <option value="daily">📅 Daily</option>
              </select>

              <span className="admin-toolbar__count" style={{ marginLeft: "auto" }}>
                Showing {filteredQuests.length} of {quests.length} quests
              </span>

              <button className="admin-refresh-btn" onClick={fetchQuests} title="Refresh">
                ↻ Refresh
              </button>
              {adminUser?.role !== "viewer" && (
                <button className="admin-add-btn" onClick={openAddQuest}>
                  + Add Quest
                </button>
              )}
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
                  {filteredQuests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-table__empty">
                        {questSearch || questStatusFilter !== "all" || questCategoryFilter !== "all"
                          ? "No matching quests found."
                          : "No quests yet. Add one!"}
                      </td>
                    </tr>
                  ) : (
                    filteredQuests.map((q) => (
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
                            onClick={() => setStatusModalQuest(q)}
                            title="Click to change status"
                          >
                            {q.status}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {q.status === "Draft" && adminUser?.role === "superadmin" && (
                              <button
                                className="admin-edit-btn"
                                onClick={() => publishQuest(q)}
                                style={{ background: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.4)", color: "#34d399", fontWeight: 800 }}
                                title="Publish this quest so players can see it"
                              >
                                🚀 Publish
                              </button>
                            )}
                            {adminUser?.role !== "viewer" && (
                              <button className="admin-edit-btn" onClick={() => openEditQuest(q)}>
                                Edit
                              </button>
                            )}
                            {adminUser?.role === "superadmin" && (
                              <button className="admin-delete-btn" onClick={() => confirmDeleteQuest(q.id)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Status Change Modal */}
            {statusModalQuest && (
              <div className="admin-modal-overlay" onClick={() => setStatusModalQuest(null)}>
                <div className="quest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, padding: 24 }}>
                  <div className="quest-modal-header">
                    <h2>Change Status</h2>
                    <button className="admin-modal__close" onClick={() => setStatusModalQuest(null)}>✕</button>
                  </div>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 20, fontSize: "0.9rem" }}>
                    Select a new status for <strong>{statusModalQuest.title}</strong>
                  </p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        className={`admin-status-badge admin-status-badge--${s.toLowerCase()}`}
                        style={{ 
                          width: "100%", 
                          padding: "12px",
                          justifyContent: "center",
                          opacity: statusModalQuest.status === s ? 0.5 : 1,
                          cursor: statusModalQuest.status === s ? "not-allowed" : "pointer"
                        }}
                        disabled={statusModalQuest.status === s || isUpdatingStatus}
                        onClick={() => updateQuestStatus(s)}
                      >
                        {isUpdatingStatus && statusModalQuest.status !== s ? "Updating..." : s}
                        {statusModalQuest.status === s && " (Current)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── VERIFICATIONS TAB ─── */}
        {tab === "verifications" && !loading && (
          <>
            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <input
                type="search"
                placeholder="Search by quester name, email, quest title, ticket code..."
                value={verificationSearch}
                onChange={(e) => setVerificationSearch(e.target.value)}
                className="admin-search-input"
                style={{ flex: "1 1 220px", minWidth: 200 }}
              />

              <select
                value={verificationStatusFilter}
                onChange={(e) => setVerificationStatusFilter(e.target.value as any)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer" }}
              >
                <option value="all">All Verification Statuses ({verifications.length})</option>
                <option value="Pending">⏳ Pending ({verifications.filter((v) => v.status === "Pending").length})</option>
                <option value="Approved">✓ Approved ({verifications.filter((v) => v.status === "Approved").length})</option>
                <option value="Rejected">✕ Rejected ({verifications.filter((v) => v.status === "Rejected").length})</option>
              </select>

              <span className="admin-toolbar__count" style={{ marginLeft: "auto" }}>
                Showing {filteredVerifications.length} of {verifications.length} submissions
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
                  {filteredVerifications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="admin-table__empty">
                        {verificationSearch || verificationStatusFilter !== "all"
                          ? "No matching quest verifications found."
                          : "No quest proof submissions yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredVerifications.map((v, i) => (
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
                            <div>
                              <span className="admin-status-badge admin-status-badge--done" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                ✕ Rejected
                              </span>
                              {v.rejection_reason && (
                                <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: 4, maxWidth: 160 }}>
                                  Reason: <em>"{v.rejection_reason}"</em>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="admin-status-badge admin-status-badge--soon">⏳ Pending</span>
                          )}
                        </td>
                        <td>
                          {v.status === "Pending" ? (
                            adminUser?.role === "viewer" ? (
                              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Read-only</span>
                            ) : (
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
                                  onClick={() => {
                                    setRejectingItem(v);
                                    setRejectionReasonInput("");
                                  }}
                                  style={{ background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )
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

        {/* ─── STAFF TAB ─── */}
        {tab === "staff" && adminUser?.role === "superadmin" && !loading && (
          <div style={{ display: "flex", gap: 24, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Staff List Table */}
            <div className="admin-table-wrapper" style={{ flex: "2 1 500px" }}>
              <div className="admin-toolbar" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <h2 style={{ fontSize: "1.2rem", margin: 0, color: "var(--gold-light)" }}>Staff Directory ({adminUsersList.length})</h2>
                <button className="admin-refresh-btn" onClick={fetchAdminUsers} title="Refresh Staff" style={{ marginLeft: "auto" }}>
                  ↻ Refresh
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsersList.filter(u => u.role !== 'booth_staff').length === 0 ? (
                    <tr><td colSpan={6} className="admin-table__empty">No other admins found.</td></tr>
                  ) : (
                    adminUsersList.filter(u => u.role !== 'booth_staff').map(user => (
                      <tr key={user.id} className="admin-table__row">
                        <td className="admin-table__num">{user.id}</td>
                        <td className="admin-table__name">{user.full_name}</td>
                        <td className="admin-table__email">{user.email}</td>
                        <td>
                          <span className={`admin-category-badge admin-category-badge--${user.role === 'superadmin' ? 'social' : user.role === 'admin' ? 'daily' : 'onboarding'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="admin-table__muted">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            type="button"
                            className="admin-refresh-btn"
                            onClick={() => handleOpenEditAdmin(user)}
                            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                          >
                            ✏️ Edit
                          </button>
                          {user.email !== adminUser.email && (
                            <button 
                              className="admin-delete-btn" 
                              onClick={() => setDeletingAdminUser(user)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Staff Form */}
            <div className="admin-login-card" style={{ flex: "1 1 300px", maxWidth: 400, marginTop: 0, padding: 24, background: "rgba(18, 18, 20, 0.6)" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: 16 }}>Create New Admin</h2>
              <form onSubmit={handleCreateAdmin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="qf-label">
                  Full Name
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="admin-login-input"
                    value={newAdminForm.full_name}
                    onChange={(e) => setNewAdminForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </label>
                <label className="qf-label">
                  Email
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    className="admin-login-input"
                    value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm(f => ({ ...f, email: e.target.value }))}
                  />
                </label>
                <label className="qf-label">
                  Password
                  <input
                    type="password"
                    required
                    placeholder="Temporary password"
                    className="admin-login-input"
                    value={newAdminForm.password}
                    onChange={(e) => setNewAdminForm(f => ({ ...f, password: e.target.value }))}
                  />
                </label>
                <label className="qf-label">
                  Role Access Level
                  <select 
                    className="admin-login-input" 
                    value={newAdminForm.role}
                    onChange={(e) => setNewAdminForm(f => ({ ...f, role: e.target.value }))}
                    style={{ padding: "12px", cursor: "pointer" }}
                  >
                    <option value="verifier">Verifier (Quest Verifications only)</option>
                    <option value="manage_attendees">Manage Attendees (Scanner & Attendees)</option>
                    <option value="admin">Manager (Scanner, Attendees, Quests)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="superadmin">Superadmin (Full Access)</option>
                  </select>
                </label>
                <button type="submit" className="admin-add-btn" disabled={isCreatingAdmin} style={{ marginTop: 8, padding: 12, justifyContent: "center" }}>
                  {isCreatingAdmin ? "Creating..." : "Create Account"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── SOCIAL MISSIONS TAB ─── */}
        {tab === "socials" && adminUser?.role === "superadmin" && !loading && (
          <div style={{ display: "flex", gap: 24, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Missions List */}
            <div className="admin-table-wrapper" style={{ flex: "2 1 500px" }}>
              <div className="admin-toolbar" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <h2 style={{ fontSize: "1.2rem", margin: 0, color: "var(--gold-light)" }}>Social Missions ({socialMissions.length})</h2>
                <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
                  <button className="admin-add-btn" onClick={() => setShowAddMissionModal(true)}>
                    + Add Mission
                  </button>
                  <button className="admin-refresh-btn" onClick={fetchSocialMissions} title="Refresh Missions">
                    ↻ Refresh
                  </button>
                </div>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>Details</th>
                    <th>Link</th>
                    <th>Sort</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {socialMissions.length === 0 ? (
                    <tr><td colSpan={5} className="admin-table__empty">No social missions found.</td></tr>
                  ) : (
                    socialMissions.map(mission => (
                      <tr key={mission.id} className="admin-table__row">
                        <td style={{ fontSize: "1.5rem" }}>
                          {mission.platform === 'facebook' ? '🌐' : mission.platform === 'telegram' ? '✈️' : mission.platform === 'twitter' ? '🐦' : '🔗'}
                        </td>
                        <td>
                          <div style={{ fontWeight: "bold" }}>{mission.title}</div>
                          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>{mission.description}</div>
                        </td>
                        <td>
                          <a href={mission.url} target="_blank" rel="noreferrer" style={{ color: "var(--gold-light)", textDecoration: "underline" }}>View Link</a>
                        </td>
                        <td>{mission.sort_order}</td>
                        <td>
                          <button 
                            className="admin-delete-btn" 
                            onClick={() => handleDeleteSocialMission(mission.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Mission Form (Modal) */}
            {showAddMissionModal && (
              <div className="admin-modal-overlay" onClick={() => setShowAddMissionModal(false)}>
                <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                  <div className="admin-modal-header">
                    <h2>Add Social Mission</h2>
                    <button className="admin-modal-close" onClick={() => setShowAddMissionModal(false)}>✕</button>
                  </div>
                  
                  <div className="admin-modal-body">
                    <form onSubmit={handleCreateSocialMission} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <label className="qf-label">
                        Platform Type
                        <select 
                          className="admin-login-input" 
                          value={newSocialMissionForm.platform}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, platform: e.target.value }))}
                          style={{ padding: "12px", cursor: "pointer" }}
                        >
                          <option value="facebook">Facebook</option>
                          <option value="telegram">Telegram</option>
                          <option value="twitter">Twitter / X</option>
                          <option value="discord">Discord</option>
                          <option value="globe">Website / Other</option>
                        </select>
                      </label>
                      <label className="qf-label">
                        Title
                        <input
                          type="text"
                          required
                          placeholder="e.g. Facebook Page"
                          className="admin-login-input"
                          value={newSocialMissionForm.title}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, title: e.target.value }))}
                        />
                      </label>
                      <label className="qf-label">
                        Description
                        <input
                          type="text"
                          required
                          placeholder="e.g. Follow BRGY Tamago"
                          className="admin-login-input"
                          value={newSocialMissionForm.description}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, description: e.target.value }))}
                        />
                      </label>
                      <label className="qf-label">
                        Target URL
                        <input
                          type="url"
                          required
                          placeholder="https://..."
                          className="admin-login-input"
                          value={newSocialMissionForm.url}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, url: e.target.value }))}
                        />
                      </label>
                      <label className="qf-label">
                        Button Text
                        <input
                          type="text"
                          required
                          placeholder="e.g. Follow FB →"
                          className="admin-login-input"
                          value={newSocialMissionForm.button_text}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, button_text: e.target.value }))}
                        />
                      </label>
                      <label className="qf-label">
                        Button Color (Hex)
                        <input
                          type="text"
                          required
                          placeholder="#1877f2"
                          className="admin-login-input"
                          value={newSocialMissionForm.button_color}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, button_color: e.target.value }))}
                        />
                      </label>
                      <label className="qf-label">
                        Sort Order
                        <input
                          type="number"
                          required
                          className="admin-login-input"
                          value={newSocialMissionForm.sort_order}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                        />
                      </label>
                    </form>
                  </div>
                  
                  <div className="admin-modal-footer">
                    <button className="admin-modal-cancel" onClick={() => setShowAddMissionModal(false)}>
                      Cancel
                    </button>
                    <button className="admin-modal-save" onClick={(e) => {
                      // Trigger form submission
                      const form = e.currentTarget.parentElement?.previousElementSibling?.querySelector('form');
                      if (form) {
                        if (form.checkValidity()) {
                          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        } else {
                          form.reportValidity();
                        }
                      }
                    }} disabled={isCreatingMission}>
                      {isCreatingMission ? "Creating..." : "Save Mission"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── BOOTH STATIONS TAB ─── */}
        {tab === "booths" && (adminUser?.role === "superadmin" || adminUser?.role === "admin") && !loading && (
          <div>
            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", margin: 0, color: "#c084fc" }}>🏪 Vendor & Booth Stations ({boothList.length})</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Manage authorized booths, view assigned scan credentials, and set 1-time visit XP reward amounts.
                </p>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <a
                  href="/booth-scan"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-refresh-btn"
                  style={{ borderColor: "rgba(168, 85, 247, 0.4)", color: "#c084fc" }}
                >
                  🚀 Open Scanner UI ↗
                </a>
                <button
                  className="admin-add-btn"
                  onClick={() => setShowAddBoothModal(true)}
                  style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", color: "#fff" }}
                >
                  + Add Booth Station
                </button>
              </div>
            </div>

            {/* Booth Performance Overview KPI Stats */}
            {(() => {
              const dbBooths = adminUsersList.filter(u => u.role === 'booth_staff');
              const totalScans = dbBooths.reduce((sum, u) => sum + (u.scan_count || 0), 0);
              const activeCount = dbBooths.filter(u => (u.scan_count || 0) >= 1).length;
              const inactiveCount = dbBooths.length - activeCount;

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
                  <div className="admin-stat-card" style={{ borderLeft: "3px solid #c084fc", background: "rgba(168,85,247,0.06)" }}>
                    <span className="admin-stat-card__icon">📊</span>
                    <div>
                      <p className="admin-stat-card__label" style={{ color: "#c084fc" }}>Total Booth Scans</p>
                      <p className="admin-stat-card__value" style={{ color: "#fff" }}>{totalScans} Attendees</p>
                    </div>
                  </div>

                  <div className="admin-stat-card" style={{ borderLeft: "3px solid #34d399", background: "rgba(16,185,129,0.06)" }}>
                    <span className="admin-stat-card__icon">⚡</span>
                    <div>
                      <p className="admin-stat-card__label" style={{ color: "#34d399" }}>Active Stations</p>
                      <p className="admin-stat-card__value">{activeCount} / {dbBooths.length || boothList.length}</p>
                    </div>
                  </div>

                  <div className="admin-stat-card" style={{ borderLeft: "3px solid #f5a623", background: "rgba(245,166,35,0.06)" }}>
                    <span className="admin-stat-card__icon">🏪</span>
                    <div>
                      <p className="admin-stat-card__label">Total Stations</p>
                      <p className="admin-stat-card__value">{dbBooths.length || boothList.length}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Booth / Vendor Name</th>
                    <th>Login Email</th>
                    <th>Total Scanned Attendees</th>
                    <th>Fixed Score (1-Time)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const dbBooths = adminUsersList.filter(u => u.role === 'booth_staff');
                    const displayList = dbBooths.length > 0
                      ? dbBooths.map(u => ({ id: u.id, name: u.full_name, email: u.email, points: 150, isDb: true, rawUser: u }))
                      : boothList;

                    return displayList.map((b: any, idx: number) => (
                      <tr key={b.id || idx} className="admin-table__row">
                        <td className="admin-table__num">{idx + 1}</td>
                        <td className="admin-table__name">
                          <strong>{b.name}</strong>
                        </td>
                        <td className="admin-table__email">
                          <code>{b.email || `booth.${b.id}@blockquest.ph`}</code>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            background: (b.rawUser?.scan_count || b.scan_count || 0) > 0 ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 255, 255, 0.04)",
                            border: (b.rawUser?.scan_count || b.scan_count || 0) > 0 ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
                            color: (b.rawUser?.scan_count || b.scan_count || 0) > 0 ? "#60a5fa" : "var(--text-muted)",
                          }}>
                            👥 {b.rawUser?.scan_count || b.scan_count || 0} Attendees
                          </span>
                        </td>
                        <td>
                          <span className="admin-xp-badge" style={{ background: "linear-gradient(135deg, #c084fc, #a855f7)", color: "#fff" }}>
                            +{b.points || 150} XP
                          </span>
                        </td>
                        <td>
                          {b.rawUser?.is_active || (b.scan_count && b.scan_count >= 1) ? (
                            <span
                              className="admin-status-badge admin-status-badge--live"
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#34d399",
                                borderColor: "rgba(16, 185, 129, 0.35)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              ⚡ Active ({b.rawUser?.scan_count || b.scan_count || 1} scans)
                            </span>
                          ) : (
                            <span
                              className="admin-status-badge"
                              style={{
                                background: "rgba(148, 163, 184, 0.12)",
                                color: "#94a3b8",
                                borderColor: "rgba(148, 163, 184, 0.25)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              ⏳ Inactive (0 scans)
                            </span>
                          )}
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-start" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditBooth(b)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "0.76rem",
                                fontWeight: 700,
                                background: "rgba(168, 85, 247, 0.12)",
                                border: "1px solid rgba(168, 85, 247, 0.35)",
                                color: "#c084fc",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(168, 85, 247, 0.25)")}
                              onMouseOut={(e) => (e.currentTarget.style.background = "rgba(168, 85, 247, 0.12)")}
                            >
                              ✏️ Edit
                            </button>

                            <a
                              href="/booth-scan"
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "0.76rem",
                                fontWeight: 700,
                                background: "rgba(245, 166, 35, 0.1)",
                                border: "1px solid rgba(245, 166, 35, 0.3)",
                                color: "var(--gold-light)",
                                textDecoration: "none",
                                transition: "all 0.2s ease"
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(245, 166, 35, 0.2)")}
                              onMouseOut={(e) => (e.currentTarget.style.background = "rgba(245, 166, 35, 0.1)")}
                            >
                              🚀 Launch ↗
                            </a>

                            {b.isDb && (
                              <button
                                type="button"
                                onClick={() => setDeletingAdminUser(b.rawUser)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "0.76rem",
                                  fontWeight: 700,
                                  background: "rgba(239, 68, 68, 0.08)",
                                  border: "1px solid rgba(239, 68, 68, 0.25)",
                                  color: "#f87171",
                                  cursor: "pointer",
                                  marginLeft: "6px",
                                  transition: "all 0.2s ease"
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
                                }}
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Modal to Edit Booth */}
            {editingBooth && (
              <div className="admin-modal-overlay" onClick={() => setEditingBooth(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                  <div className="admin-modal__header" style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>✏️</span> Edit Booth Station & XP Points
                    </h2>
                    <button className="admin-modal__close" onClick={() => setEditingBooth(null)}>✕</button>
                  </div>

                  <form onSubmit={handleUpdateBoothStation} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <label className="qf-label">
                      Booth / Vendor Station Name *
                      <input
                        type="text"
                        required
                        className="qf-input"
                        value={editBoothForm.name}
                        onChange={(e) => setEditBoothForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Assigned Login Email *
                      <input
                        type="email"
                        required
                        className="qf-input"
                        value={editBoothForm.email}
                        onChange={(e) => setEditBoothForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Reset Password (leave blank to keep current)
                      <input
                        type="password"
                        placeholder="New password (optional)"
                        className="qf-input"
                        value={editBoothForm.password}
                        onChange={(e) => setEditBoothForm(f => ({ ...f, password: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Fixed XP Score per Attendee First Visit (XP Points)
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        required
                        className="qf-input"
                        value={editBoothForm.points}
                        onChange={(e) => setEditBoothForm(f => ({ ...f, points: Number(e.target.value) || 150 }))}
                      />
                    </label>

                    <div className="admin-modal__footer" style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button type="button" className="admin-cancel-btn" onClick={() => setEditingBooth(null)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdatingBooth}
                        className="admin-save-btn"
                        style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", color: "#fff" }}
                      >
                        {isUpdatingBooth ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal to Add Booth */}
            {showAddBoothModal && (
              <div className="admin-modal-overlay" onClick={() => setShowAddBoothModal(false)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                  <div className="admin-modal__header" style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🏪</span> Create Vendor Booth Station
                    </h2>
                    <button className="admin-modal__close" onClick={() => setShowAddBoothModal(false)}>✕</button>
                  </div>

                  <form onSubmit={handleCreateBoothStation} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <label className="qf-label">
                      Booth / Vendor Station Name *
                      <input
                        type="text"
                        required
                        placeholder="e.g. Polygon Guild Booth"
                        className="qf-input"
                        value={newBoothForm.name}
                        onChange={(e) => setNewBoothForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Assigned Login Email *
                      <input
                        type="email"
                        required
                        placeholder="e.g. booth.polygon@blockquest.ph"
                        className="qf-input"
                        value={newBoothForm.email}
                        onChange={(e) => setNewBoothForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Temporary Password *
                      <input
                        type="password"
                        required
                        placeholder="Password for booth staff"
                        className="qf-input"
                        value={newBoothForm.password}
                        onChange={(e) => setNewBoothForm(f => ({ ...f, password: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Fixed XP Score per Attendee First Visit
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        required
                        className="qf-input"
                        value={newBoothForm.points}
                        onChange={(e) => setNewBoothForm(f => ({ ...f, points: Number(e.target.value) || 150 }))}
                      />
                    </label>

                    <div className="admin-modal__footer" style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button type="button" className="admin-cancel-btn" onClick={() => setShowAddBoothModal(false)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingBooth}
                        className="admin-save-btn"
                        style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", color: "#fff" }}
                      >
                        {isCreatingBooth ? "Provisioning…" : "Create & Authorize"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── QUEST MODAL (Redesigned with Live Preview) ─── */}
      {showQuestModal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="quest-modal-wide" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="quest-modal-header" style={{ position: "relative" }}>
              <div className="quest-modal-header__title">
                <span className="quest-modal-header__icon">{editingQuest ? "✏️" : "⚡"}</span>
                <div>
                  <h2>{editingQuest ? "Edit Quest" : "Create New Quest"}</h2>
                  <p>Fill in the form — the preview card updates in real time.</p>
                </div>
              </div>
              <button className="admin-modal__close" onClick={closeModal}>✕</button>
            </div>

            {/* Draft Restore Alert Banner */}
            {hasSavedDraft && !editingQuest && (
              <div style={{
                background: "rgba(245, 166, 35, 0.15)",
                borderBottom: "1px solid rgba(245, 166, 35, 0.3)",
                padding: "10px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <span style={{ fontSize: "0.85rem", color: "#ffd166" }}>
                  📝 Found an unfinished quest draft. Would you like to resume?
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={resumeDraft}
                    style={{
                      background: "#f5a623",
                      color: "#120b02",
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={discardDraft}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Description <small style={{ fontWeight: 400, color: "#64748b" }}>(supports line breaks & bullet points)</small></span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          className="qf-pill"
                          style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                          onClick={() => setQuestForm((f) => ({
                            ...f,
                            description: (f.description ? f.description + "\n" : "") + "• Step 1:\n• Step 2:\n• Step 3:"
                          }))}
                          title="Insert bulleted list template"
                        >
                          + Bullet List
                        </button>
                        <button
                          type="button"
                          className="qf-pill"
                          style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                          onClick={() => setQuestForm((f) => ({
                            ...f,
                            description: (f.description ? f.description + "\n" : "") + "1. Visit the page\n2. Complete action\n3. Take a screenshot"
                          }))}
                          title="Insert numbered list template"
                        >
                          + Numbered List
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={questForm.description ?? ""}
                      onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder={`Format example:\n1. Follow @BlockQuest on X\n2. Retweet pinned tweet\n3. Upload screenshot proof below`}
                      rows={5}
                      className="qf-input"
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        lineHeight: 1.5,
                        minHeight: 100,
                        resize: "vertical"
                      }}
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
                  <button type="button" className="admin-cancel-btn" onClick={closeModal}>Cancel</button>
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
                    <div className="quest-preview-card__desc" style={{ whiteSpace: "pre-wrap" }}>{questForm.description}</div>
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


      {/* Proof Fullscreen Image Modal with Interactive Zoom & Pan */}
      {selectedProofImage && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            setSelectedProofImage(null);
            resetZoom();
          }}
          style={{ zIndex: 1000, background: "rgba(0,0,0,0.9)", userSelect: "none" }}
        >
          <div
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Floating Zoom Toolbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(20, 20, 30, 0.85)",
                border: "1px solid rgba(245, 166, 35, 0.4)",
                borderRadius: 30,
                padding: "6px 18px",
                marginBottom: 14,
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(s - 0.3, 0.5))}
                title="Zoom Out (-)"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                −
              </button>

              <span
                style={{
                  color: "#fbbf24",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  minWidth: 50,
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              >
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(s + 0.3, 4))}
                title="Zoom In (+)"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>

              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

              <button
                type="button"
                onClick={resetZoom}
                title="Reset Zoom"
                style={{
                  background: "rgba(245, 166, 35, 0.15)",
                  border: "1px solid rgba(245, 166, 35, 0.3)",
                  color: "#fbbf24",
                  borderRadius: 14,
                  padding: "4px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>

            {/* Image Container with Scroll Wheel Zoom & Drag Pan */}
            <div
              onWheel={handleWheelZoom}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                overflow: "hidden",
                borderRadius: 12,
                border: "2px solid rgba(245,166,35,0.6)",
                boxShadow: "0 0 40px rgba(0,0,0,0.8)",
                cursor: zoomScale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                maxWidth: "100%",
                maxHeight: "75vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#050508",
              }}
            >
              <img
                src={selectedProofImage}
                alt="Proof Full Resolution"
                draggable={false}
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  transform: `translate(${zoomPos.x}px, ${zoomPos.y}px) scale(${zoomScale})`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out",
                  transformOrigin: "center center",
                  objectFit: "contain",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
              <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.4)" }}>
                💡 Scroll mouse wheel to zoom in/out • Click and drag to pan when zoomed
              </span>
              <button
                className="admin-cancel-btn"
                onClick={() => {
                  setSelectedProofImage(null);
                  resetZoom();
                }}
                style={{
                  padding: "8px 24px",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingItem && (
        <div
          className="admin-modal-overlay"
          onClick={() => setRejectingItem(null)}
          style={{ zIndex: 1000, background: "rgba(0,0,0,0.85)" }}
        >
          <div
            className="admin-modal"
            style={{ maxWidth: 440, width: "90%", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
              <span>✕</span> Reject Verification
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "8px 0 16px" }}>
              Rejecting submission from <strong>{rejectingItem.user_name}</strong> for <em>"{rejectingItem.quest_title}"</em>.
            </p>

            <label className="qf-label" style={{ display: "block", marginBottom: 8 }}>
              Reason for Rejection (Optional)
            </label>
            <textarea
              className="qf-input"
              rows={3}
              placeholder="e.g., Image unclear, invalid proof, duplicate screenshot..."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              style={{ width: "100%", resize: "vertical", marginBottom: 20 }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="admin-cancel-btn"
                onClick={() => setRejectingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-delete-btn"
                onClick={async () => {
                  const target = rejectingItem;
                  setRejectingItem(null);
                  await handleVerifyQuest(target.id, "Rejected", rejectionReasonInput.trim());
                }}
                style={{ background: "#ef4444", color: "#fff", borderColor: "#dc2626" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Admin Modal ── */}
      {editingAdminUser && (
        <div className="admin-modal-overlay" onClick={() => setEditingAdminUser(null)}>
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: "92%" }}
          >
            <div className="admin-modal__header" style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.4rem" }}>✏️</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>Edit Admin Account</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Update details, role permissions, or password
                  </p>
                </div>
              </div>
              <button className="admin-modal__close" onClick={() => setEditingAdminUser(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="admin-quest-form" style={{ padding: "24px 28px" }}>
              <label className="qf-label">
                Full Name
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="qf-input"
                  value={editAdminForm.full_name}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </label>

              <label className="qf-label">
                Email Address
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  className="qf-input"
                  value={editAdminForm.email}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>

              <label className="qf-label">
                Role Access Level
                <select
                  className="qf-input"
                  value={editAdminForm.role}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, role: e.target.value }))}
                  style={{ cursor: "pointer" }}
                >
                  <option value="verifier">Verifier (Quest Verifications only)</option>
                  <option value="manage_attendees">Manage Attendees (Scanner & Attendees)</option>
                  <option value="admin">Manager (Scanner, Attendees, Quests)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="superadmin">Superadmin (Full Access)</option>
                </select>
              </label>

              <label className="qf-label">
                New Password <small style={{ color: "var(--text-muted)" }}>(Leave blank to keep unchanged)</small>
                <input
                  type="password"
                  placeholder="Enter new password to change"
                  className="qf-input"
                  value={editAdminForm.password}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, password: e.target.value }))}
                />
              </label>

              <div className="admin-modal__footer" style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  className="admin-cancel-btn"
                  onClick={() => setEditingAdminUser(null)}
                  disabled={isUpdatingAdmin}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-save-btn"
                  disabled={isUpdatingAdmin}
                >
                  {isUpdatingAdmin ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Admin Modal ── */}
      {deletingAdminUser && (
        <div className="admin-modal-overlay" onClick={() => setDeletingAdminUser(null)}>
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: "92%" }}
          >
            <div className="admin-modal__header" style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.4rem" }}>⚠️</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#ef4444" }}>Delete Admin</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    This action is permanent and cannot be undone
                  </p>
                </div>
              </div>
              <button className="admin-modal__close" onClick={() => setDeletingAdminUser(null)}>✕</button>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                Are you sure you want to permanently delete the admin account for <strong>{deletingAdminUser.full_name}</strong> ({deletingAdminUser.email})?
              </p>

              <div className="admin-modal__footer" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  className="admin-cancel-btn"
                  onClick={() => setDeletingAdminUser(null)}
                  disabled={isDeletingAdmin}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-delete-btn"
                  onClick={executeDeleteAdmin}
                  disabled={isDeletingAdmin}
                  style={{ padding: "11px 24px", fontSize: "0.9rem", borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                >
                  {isDeletingAdmin ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Quest Modal ── */}
      {deletingQuestId && (
        <div className="admin-modal-overlay" onClick={() => setDeletingQuestId(null)}>
          <div
            className="admin-modal"
            style={{ maxWidth: 400, width: "90%", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span> Delete Quest Warning
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "8px 0 16px" }}>
              Are you sure you want to permanently delete this quest? This action cannot be undone.
              <br/><br/>
              To proceed, please type the Quest ID: <strong>{deletingQuestId}</strong>
            </p>

            <input
              type="text"
              className="qf-input"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Enter Quest ID here"
              style={{ width: "100%", marginBottom: 20 }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="admin-cancel-btn"
                onClick={() => setDeletingQuestId(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-delete-btn"
                onClick={executeDeleteQuest}
                disabled={deleteConfirmation !== deletingQuestId || isDeleting}
                style={{ 
                  background: deleteConfirmation === deletingQuestId ? "#ef4444" : "var(--border)", 
                  color: "#fff", 
                  borderColor: deleteConfirmation === deletingQuestId ? "#dc2626" : "var(--border)", 
                  opacity: deleteConfirmation === deletingQuestId ? 1 : 0.5, 
                  cursor: deleteConfirmation === deletingQuestId ? "pointer" : "not-allowed" 
                }}
              >
                {isDeleting ? "Deleting..." : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
