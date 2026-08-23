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
  category: "onboarding" | "social" | "daily" | "quiz" | "atfx";
  action_label: string | null;
  action_url: string | null;
  requires_proof?: boolean;
  requires_message?: boolean;
  is_quiz?: boolean;
  quiz_answer?: string;
  quiz_options?: string[];
  correct_option_index?: number;
  passcode?: string;
  expires_at?: string;
  depends_on_quest_id?: string;
  sort_order: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
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
  user_message?: string | null;
  status: "Pending" | "Approved" | "Rejected";
  rejection_reason?: string | null;
  approved_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  requires_password_change?: boolean;
}


const ADMIN_TABS = ["scanner", "attendees", "quests", "verifications", "messages", "questlog", "socials", "booths", "staff"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const STATUS_OPTIONS: Quest["status"][] = ["Live", "Soon", "Done", "Draft"];
const CATEGORY_OPTIONS: Quest["category"][] = ["onboarding", "social", "daily", "quiz", "atfx"];

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
  requires_message: false,
  is_quiz: false,
  quiz_answer: "",
  quiz_options: [],
  correct_option_index: 0,
  passcode: "",
  expires_at: "",
  depends_on_quest_id: "",
  sort_order: 99,
};

interface PaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function PaginationBar({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16, padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="admin-search-input"
          style={{ width: "auto", padding: "4px 10px", fontSize: "0.85rem", cursor: "pointer" }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span style={{ marginLeft: 8 }}>
          Showing <strong>{totalItems > 0 ? startIndex + 1 : 0}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems}</strong>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          style={{
            opacity: safePage <= 1 ? 0.4 : 1,
            cursor: safePage <= 1 ? "not-allowed" : "pointer",
            padding: "6px 14px"
          }}
        >
          ← Prev
        </button>

        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--gold-light)", padding: "0 8px" }}>
          Page {safePage} of {totalPages}
        </span>

        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          style={{
            opacity: safePage >= totalPages ? 0.4 : 1,
            cursor: safePage >= totalPages ? "not-allowed" : "pointer",
            padding: "6px 14px"
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

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
  
  // ── Change Password Modal ──
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  // ── Session persistence & Idle Timeout ──
  useEffect(() => {
    setMounted(true);
    // Restore authenticated session from localStorage (works across tabs)
    const savedSession = localStorage.getItem("blockquest_admin_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.authed && session.adminUser) {
          if (session.adminUser.role === "booth_staff") {
            localStorage.removeItem("blockquest_admin_session");
          } else {
            setAuthed(true);
            setAdminUser(session.adminUser);
            if (session.adminUser.requires_password_change) {
                setShowChangePasswordModal(true);
            }
          }
        }
      } catch (e) { }
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

  // ── Attendee search & filter & pagination ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked" | "pending">("all");
  const [attendeePage, setAttendeePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  useEffect(() => {
    setAttendeePage(1);
  }, [search, statusFilter, pageSize]);

  // ── Quest search & filter ──
  const [questSearch, setQuestSearch] = useState("");
  const [questStatusFilter, setQuestStatusFilter] = useState<"all" | Quest["status"]>("all");
  const [questCategoryFilter, setQuestCategoryFilter] = useState<"all" | Quest["category"]>("all");
  const [questVerificationModeFilter, setQuestVerificationModeFilter] = useState<"all" | "instant" | "proof_only" | "message_only" | "photo_and_message" | "quiz" | "passcode">("all");

  // ── Verification search & filter ──
  const [verificationSearch, setVerificationSearch] = useState("");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<"all" | QuestVerification["status"]>("all");
  const [verificationModeFilter, setVerificationModeFilter] = useState<"all" | "photo_only" | "photo_and_message">("all");
  const [verificationCategoryFilter, setVerificationCategoryFilter] = useState<string>("all");

  // ── Message Notes state & search filter ──
  const [messageNotes, setMessageNotes] = useState<QuestVerification[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageStatusFilter, setMessageStatusFilter] = useState<"all" | QuestVerification["status"]>("all");

  // ── Quest Log customizable reporting table state ──
  const [questLogSearch, setQuestLogSearch] = useState("");
  const [questLogStatusFilter, setQuestLogStatusFilter] = useState<string>("all");
  const [questLogCategoryFilter, setQuestLogCategoryFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState({
    quester: true,
    email: true,
    ticket: true,
    quest: true,
    category: true,
    xp: true,
    type: true,
    status: true,
    reviewer: true,
    date: true,
  });

  // ── Pagination states ──
  const [questPage, setQuestPage] = useState(1);
  const [questPageSize, setQuestPageSize] = useState(10);
  useEffect(() => setQuestPage(1), [questSearch, questStatusFilter, questCategoryFilter, questVerificationModeFilter, questPageSize]);

  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationPageSize, setVerificationPageSize] = useState(10);
  useEffect(() => setVerificationPage(1), [verificationSearch, verificationStatusFilter, verificationModeFilter, verificationCategoryFilter, verificationPageSize]);

  const [messagePage, setMessagePage] = useState(1);
  const [messagePageSize, setMessagePageSize] = useState(10);
  useEffect(() => setMessagePage(1), [messageSearch, messageStatusFilter, messagePageSize]);

  const [questLogPage, setQuestLogPage] = useState(1);
  const [questLogPageSize, setQuestLogPageSize] = useState(10);
  useEffect(() => setQuestLogPage(1), [questLogSearch, questLogStatusFilter, questLogCategoryFilter, questLogPageSize]);

  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);

  const [socialPage, setSocialPage] = useState(1);
  const [socialPageSize, setSocialPageSize] = useState(10);

  const [boothPage, setBoothPage] = useState(1);
  const [boothPageSize, setBoothPageSize] = useState(10);

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

  // ── Reset PIN Studio Modal States ──
  const [resetPinAttendee, setResetPinAttendee] = useState<Attendee | null>(null);
  const [resetPinInput, setResetPinInput] = useState("");
  const [resetPinResult, setResetPinResult] = useState<{ tempPin: string; attendee: any } | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [copiedPinToast, setCopiedPinToast] = useState(false);

  // ── Delete Attendee Modal States (Superadmin only) ──
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);
  const [deleteConfirmEmailInput, setDeleteConfirmEmailInput] = useState("");
  const [isDeletingAttendee, setIsDeletingAttendee] = useState(false);

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
  const [newSocialMissionForm, setNewSocialMissionForm] = useState({ platform: "facebook", title: "", description: "", url: "", button_text: "", button_color: "#1877f2", sort_order: 0, is_active: true });
  const [isCreatingMission, setIsCreatingMission] = useState(false);
  const [showAddMissionModal, setShowAddMissionModal] = useState(false);

  const [editingSocialMission, setEditingSocialMission] = useState<any | null>(null);
  const [editSocialMissionForm, setEditSocialMissionForm] = useState({ id: 0, platform: "facebook", title: "", description: "", url: "", button_text: "", button_color: "#1877f2", sort_order: 0, is_active: true });
  const [isUpdatingMission, setIsUpdatingMission] = useState(false);

  // ── Copy tooltip ──
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ── Privacy / Masking for Attendees Contact Info ──
  const [revealEmails, setRevealEmails] = useState(false);
  const [revealPhones, setRevealPhones] = useState(false);
  const [revealedEmailIds, setRevealedEmailIds] = useState<Set<number>>(new Set());
  const [revealedPhoneIds, setRevealedPhoneIds] = useState<Set<number>>(new Set());

  // ── Privacy / Masking for Quest Log Emails ──
  const [revealQuestLogEmails, setRevealQuestLogEmails] = useState(false);
  const [revealedQuestLogKeys, setRevealedQuestLogKeys] = useState<Set<string>>(new Set());

  const toggleRevealEmail = (id: number) => {
    setRevealedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRevealPhone = (id: number) => {
    setRevealedPhoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRevealQuestLogEmail = (key: string) => {
    setRevealedQuestLogKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const maskEmail = (em: string) => {
    if (!em) return "—";
    const parts = em.split("@");
    if (parts.length < 2) return "••••••••";
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 ? name[0] + "***" : name.slice(0, 2) + "***" + name.slice(-1);
    return `${maskedName}@${domain}`;
  };

  const maskPhone = (ph: string) => {
    if (!ph) return "—";
    const clean = ph.trim();
    if (clean.length <= 5) return "•••••";
    return clean.slice(0, 4) + " ••• " + clean.slice(-2);
  };

  // ─── Token & Admin Fetch Helper ──────────────────────────────────────────
  function getAdminToken(): string {
    if (typeof window === "undefined") return "";
    try {
      const savedSession = localStorage.getItem("blockquest_admin_session");
      if (savedSession) {
        const session = JSON.parse(savedSession);
        return session.token || "";
      }
    } catch {}
    return "";
  }

  const adminFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getAdminToken();
    const headers = new Headers(options.headers || {});
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, []);

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
      const role = json.adminUser?.role;
      if (role === "booth_staff") {
        throw new Error("Access Denied. Booth Staff accounts are restricted to the Booth Scanner portal (/booth-scan) and cannot access the Admin Dashboard.");
      }

      setAdminUser(json.adminUser);
      setAuthed(true);
      if (json.adminUser.requires_password_change) {
        setShowChangePasswordModal(true);
      }
      localStorage.setItem("blockquest_admin_session", JSON.stringify({
        authed: true,
        adminUser: json.adminUser,
        token: json.token,
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
    localStorage.removeItem("blockquest_admin_session");
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePasswordLoading(true);
    setChangePasswordError("");
    try {
        if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
            throw new Error("New passwords do not match.");
        }
        const res = await adminFetch("/api/admin/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: adminUser?.email,
                oldPassword: changePasswordForm.oldPassword,
                newPassword: changePasswordForm.newPassword
            })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to change password");
        
        setShowChangePasswordModal(false);
        setChangePasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        
        // Update user state and storage to reflect no longer requiring password change
        if (adminUser) {
            const updatedUser = { ...adminUser, requires_password_change: false };
            setAdminUser(updatedUser);
            const savedSession = localStorage.getItem("blockquest_admin_session");
            const parsedSession = savedSession ? JSON.parse(savedSession) : {};
            localStorage.setItem("blockquest_admin_session", JSON.stringify({
                ...parsedSession,
                authed: true,
                adminUser: updatedUser
            }));
        }
        alert("Password updated successfully!");
    } catch (err: any) {
        setChangePasswordError(err.message);
    } finally {
        setChangePasswordLoading(false);
    }
  }

  // ─── Fetch data ──────────────────────────────────────────────────────────
  const fetchAttendees = useCallback(async (isBackground?: any) => {
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/admin/attendees?limit=3000");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load attendees.");
      setAttendees(json.attendees ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminFetch]);

  const fetchQuests = useCallback(async (isBackground?: any) => {
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/admin/quests");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load quests.");
      setQuests(json.quests ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminFetch]);

  const fetchVerifications = useCallback(async (isBackground?: any) => {
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/admin/verifications?limit=1500");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load verifications.");
      setVerifications(json.verifications ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminFetch]);

  const fetchMessageNotes = useCallback(async (isBackground?: any) => {
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/admin/messages?limit=1500");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load message notes.");
      setMessageNotes(json.messages ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminFetch]);

  const fetchAdminUsers = useCallback(async (isBackground?: any) => {
    if (adminUser?.role !== "superadmin" && adminUser?.role !== "admin") return;
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load admin users.");
      setAdminUsersList(json.adminUsers ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminUser, adminFetch]);

  const fetchSocialMissions = useCallback(async (isBackground?: any) => {
    if (adminUser?.role !== "superadmin") return;
    const isBg = isBackground === true;
    if (!isBg) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminFetch("/api/social-missions");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load social missions.");
      setSocialMissions(json.missions ?? []);
    } catch (err: any) {
      if (!isBg) setError(err.message);
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [adminUser, adminFetch]);

  // Load ALL data immediately on auth so stat cards are always accurate
  useEffect(() => {
    if (!authed) return;
    fetchAttendees();
    fetchQuests();
    fetchVerifications();
    fetchMessageNotes();
  }, [authed, fetchAttendees, fetchQuests, fetchVerifications, fetchMessageNotes]);

  // Refresh current tab data when switching tabs
  useEffect(() => {
    if (!authed) return;
    if (tab === "attendees") fetchAttendees();
    else if (tab === "quests") fetchQuests();
    else if (tab === "verifications") fetchVerifications();
    else if (tab === "messages") fetchMessageNotes();
    else if (tab === "questlog") {
      fetchVerifications();
      fetchMessageNotes();
    }
    else if (tab === "staff") fetchAdminUsers();
    else if (tab === "socials") fetchSocialMissions();
  }, [tab, fetchAttendees, fetchQuests, fetchVerifications, fetchMessageNotes, fetchAdminUsers, fetchSocialMissions]);

  // ── Auto Refresh (Background Silent Polling - No UI Flickering) ──
  useEffect(() => {
    if (!authed || !autoRefresh || tab === "scanner") return;
    const interval = setInterval(() => {
      if (tab === "attendees") fetchAttendees(true);
      else if (tab === "quests") fetchQuests(true);
      else if (tab === "verifications") fetchVerifications(true);
      else if (tab === "messages") fetchMessageNotes(true);
      else if (tab === "questlog") {
        fetchVerifications(true);
        fetchMessageNotes(true);
      }
      else if (tab === "staff") fetchAdminUsers(true);
      else if (tab === "socials") fetchSocialMissions(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [authed, autoRefresh, tab, fetchAttendees, fetchQuests, fetchVerifications, fetchMessageNotes, fetchAdminUsers, fetchSocialMissions]);

  const [rejectingItem, setRejectingItem] = useState<QuestVerification | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // ── Quest Verification Action Modal State ──
  const [actionModalVerification, setActionModalVerification] = useState<QuestVerification | null>(null);
  const [verificationActionReason, setVerificationActionReason] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [deletingQuestId, setDeletingQuestId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleVerifyQuest(id: number, newStatus: "Approved" | "Rejected" | "Pending", reason?: string) {
    const reviewer = adminUser?.email || "Admin";
    setIsProcessingAction(true);
    try {
      const res = await adminFetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, rejection_reason: reason, approved_by: reviewer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update verification.");
      setVerifications((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: newStatus, rejection_reason: reason || null, approved_by: reviewer, reviewed_at: new Date().toISOString() }
            : item
        )
      );
      if (actionModalVerification?.id === id) {
        setActionModalVerification(null);
        setVerificationActionReason("");
      }
    } catch (err: any) {
      alert("Verification Error: " + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  }

  async function handleVerifyMessage(id: number, newStatus: "Approved" | "Rejected" | "Pending", reason?: string) {
    const reviewer = adminUser?.email || "Admin";
    try {
      const res = await adminFetch("/api/admin/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, rejection_reason: reason, approved_by: reviewer }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update message note.");
      setMessageNotes((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: newStatus, rejection_reason: reason || null, approved_by: reviewer, reviewed_at: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      alert("Message Note Verification Error: " + err.message);
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

  const totalAttendeePages = Math.ceil(filteredAttendees.length / pageSize) || 1;
  const safeAttendeePage = Math.min(attendeePage, totalAttendeePages);
  const attendeeStartIndex = (safeAttendeePage - 1) * pageSize;
  const paginatedAttendees = filteredAttendees.slice(
    attendeeStartIndex,
    attendeeStartIndex + pageSize
  );

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

    // Verification Mode filter (all 6 modes from modal)
    if (questVerificationModeFilter === "instant") {
      if (q.requires_proof || q.requires_message || q.is_quiz || !!q.passcode) return false;
    } else if (questVerificationModeFilter === "proof_only") {
      if (!q.requires_proof || q.requires_message) return false;
    } else if (questVerificationModeFilter === "message_only") {
      if (!q.requires_message || q.requires_proof) return false;
    } else if (questVerificationModeFilter === "photo_and_message") {
      if (!q.requires_proof || !q.requires_message) return false;
    } else if (questVerificationModeFilter === "quiz") {
      if (!q.is_quiz) return false;
    } else if (questVerificationModeFilter === "passcode") {
      if (!q.passcode || q.requires_proof || q.requires_message || q.is_quiz) return false;
    }

    return true;
  });

  // ─── Verification helpers (Screenshot proofs ONLY) ─────────────────────────
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
    const questCategory = quests.find(q => q.id === v.quest_id)?.category || "other";
    if (verificationCategoryFilter !== "all" && questCategory !== verificationCategoryFilter) return false;
    if (verificationModeFilter === "photo_only" && v.user_message) return false;
    if (verificationModeFilter === "photo_and_message" && !v.user_message) return false;
    return true;
  }).sort((a, b) => {
    const getPriority = (st: string) => {
      if (st === "Pending") return 0;
      if (st === "Rejected") return 1;
      return 2; // "Approved" at the bottom
    };
    const diff = getPriority(a.status) - getPriority(b.status);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ─── Message Notes helpers (Text Notes ONLY) ───────────────────────────────
  const filteredMessageVerifications = messageNotes.filter((v) => {
    const query = messageSearch.toLowerCase();
    const matchesQuery =
      !query ||
      v.user_name.toLowerCase().includes(query) ||
      v.user_email.toLowerCase().includes(query) ||
      v.quest_title.toLowerCase().includes(query) ||
      (v.user_message ?? "").toLowerCase().includes(query) ||
      (v.ticket_code ?? "").toLowerCase().includes(query);

    if (!matchesQuery) return false;
    if (messageStatusFilter !== "all" && v.status !== messageStatusFilter) return false;
    return true;
  }).sort((a, b) => {
    const getPriority = (st: string) => {
      if (st === "Pending") return 0;
      if (st === "Rejected") return 1;
      return 2; // "Approved" at the bottom
    };
    const diff = getPriority(a.status) - getPriority(b.status);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
      const res = await adminFetch("/api/admin/checkin", {
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

  function openResetPinModal(attendee: Attendee) {
    setResetPinAttendee(attendee);
    setResetPinInput("");
    setResetPinResult(null);
    setCopiedPinToast(false);
  }

  async function handleExecuteResetPin(customPin?: string) {
    if (!resetPinAttendee) return;
    setIsResettingPin(true);
    try {
      const pinToUse = customPin !== undefined ? customPin : resetPinInput.trim();
      const res = await adminFetch("/api/admin/attendees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resetPinAttendee.id, tempPin: pinToUse }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reset PIN");

      setAttendees((prev) =>
        prev.map((item) => (item.id === resetPinAttendee.id ? { ...item, pincode: json.tempPin } : item))
      );

      setResetPinResult({ tempPin: json.tempPin, attendee: resetPinAttendee });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsResettingPin(false);
    }
  }

  async function handleConfirmDeleteAttendee() {
    if (!deletingAttendee) return;
    setIsDeletingAttendee(true);
    try {
      const res = await adminFetch("/api/admin/attendees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingAttendee.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete attendee");

      setAttendees((prev) => prev.filter((item) => item.id !== deletingAttendee.id));
      setDeletingAttendee(null);
      alert(`Attendee ${deletingAttendee.full_name} and all related Zealy quest records were permanently deleted.`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsDeletingAttendee(false);
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

  function exportVerificationsToCSV() {
    if (filteredVerifications.length === 0) {
      alert("No quest verifications match the current filters.");
      return;
    }
    const headers = [
      "ID",
      "Quester Name",
      "Email",
      "Ticket Code",
      "Quest Title",
      "Category",
      "XP",
      "Status",
      "User Message",
      "Proof Screenshot URL",
      "Reviewed By",
      "Rejection Reason",
      "Submitted At"
    ];

    const rows = filteredVerifications.map((v) => {
      const qCategory = quests.find((q) => q.id === v.quest_id)?.category || "other";
      return [
        v.id,
        `"${(v.user_name || "").replace(/"/g, '""')}"`,
        `"${(v.user_email || "").replace(/"/g, '""')}"`,
        `"${(v.ticket_code || "").replace(/"/g, '""')}"`,
        `"${(v.quest_title || "").replace(/"/g, '""')}"`,
        `"${qCategory}"`,
        v.xp || 0,
        `"${v.status}"`,
        `"${(v.user_message || "").replace(/"/g, '""')}"`,
        `"${(v.proof_url || "").replace(/"/g, '""')}"`,
        `"${(v.approved_by || "").replace(/"/g, '""')}"`,
        `"${(v.rejection_reason || "").replace(/"/g, '""')}"`,
        `"${new Date(v.created_at).toLocaleString()}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quest_Verifications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportMessageNotesToCSV() {
    if (filteredMessageVerifications.length === 0) {
      alert("No message notes match the current filters.");
      return;
    }
    const headers = [
      "ID",
      "Quester Name",
      "Email",
      "Ticket Code",
      "Quest Title",
      "XP",
      "Status",
      "Message Note",
      "Attached Photo URL",
      "Reviewed By",
      "Rejection Reason",
      "Submitted At"
    ];

    const rows = filteredMessageVerifications.map((v) => [
      v.id,
      `"${(v.user_name || "").replace(/"/g, '""')}"`,
      `"${(v.user_email || "").replace(/"/g, '""')}"`,
      `"${(v.ticket_code || "").replace(/"/g, '""')}"`,
      `"${(v.quest_title || "").replace(/"/g, '""')}"`,
      v.xp || 0,
      `"${v.status}"`,
      `"${(v.user_message || "").replace(/"/g, '""')}"`,
      `"${(v.proof_url || "").replace(/"/g, '""')}"`,
      `"${(v.approved_by || "").replace(/"/g, '""')}"`,
      `"${(v.rejection_reason || "").replace(/"/g, '""')}"`,
      `"${new Date(v.created_at).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendee_Message_Notes_${new Date().toISOString().slice(0, 10)}.csv`);
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
    } catch { }
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
        } catch { }
      }
    }
    setShowQuestModal(false);
  }

  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { }
    setHasSavedDraft(false);
    setQuestForm({ ...EMPTY_QUEST });
  }

  function resumeDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setQuestForm(JSON.parse(raw));
    } catch { }
    setHasSavedDraft(false);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { }
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
      requires_message: q.requires_message ?? false,
      is_quiz: q.is_quiz ?? false,
      quiz_answer: q.quiz_answer ?? "",
      passcode: q.passcode ?? "",
      expires_at: q.expires_at ?? "",
      depends_on_quest_id: q.depends_on_quest_id ?? "",
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
        admin_email: adminUser?.email,
        admin_name: adminUser?.fullName || adminUser?.email || "Admin",
      };
      const res = await adminFetch("/api/admin/quests", {
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
      const res = await adminFetch("/api/admin/quests", {
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
      const reviewer = adminUser?.fullName || adminUser?.email || "Admin";
      const res = await adminFetch("/api/admin/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: statusModalQuest.id, status: newStatus, admin_email: adminUser?.email, admin_name: reviewer }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      setQuests((prev) => prev.map((q) => (q.id === statusModalQuest.id ? { ...q, status: newStatus, updated_by: reviewer, updated_at: new Date().toISOString() } : q)));
      setStatusModalQuest(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function publishQuest(quest: Quest) {
    try {
      const reviewer = adminUser?.fullName || adminUser?.email || "Admin";
      const res = await adminFetch("/api/admin/quests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quest.id, status: "Live", admin_email: adminUser?.email, admin_name: reviewer }),
      });
      if (!res.ok) throw new Error("Failed to publish quest.");
      setQuests((prev) => prev.map((q) => (q.id === quest.id ? { ...q, status: "Live", updated_by: reviewer, updated_at: new Date().toISOString() } : q)));
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
      const res = await adminFetch("/api/admin/quests", {
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

      const res = await adminFetch("/api/admin/users", {
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
        const savedSession = localStorage.getItem("blockquest_admin_session");
        const parsedSession = savedSession ? JSON.parse(savedSession) : {};
        localStorage.setItem(
          "blockquest_admin_session",
          JSON.stringify({ ...parsedSession, authed: true, adminUser: updatedSelf })
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
      const res = await adminFetch("/api/admin/users", {
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

        const res = await adminFetch("/api/admin/users", {
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
      const res = await adminFetch("/api/admin/users", {
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
      const res = await adminFetch("/api/admin/users", {
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
      const res = await adminFetch("/api/admin/social-missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSocialMissionForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create social mission");

      setSocialMissions(prev => [...prev, json.mission]);
      setNewSocialMissionForm({ platform: "facebook", title: "", description: "", url: "", button_text: "", button_color: "#1877f2", sort_order: 0, is_active: true });
      setShowAddMissionModal(false);
      alert("Social mission created successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsCreatingMission(false);
    }
  }

  async function handleToggleSocialMissionActive(mission: any) {
    const nextStatus = mission.is_active === false ? true : false;
    try {
      const res = await adminFetch("/api/admin/social-missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mission.id, is_active: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update mission status");

      setSocialMissions(prev => prev.map(m => m.id === mission.id ? { ...m, is_active: nextStatus } : m));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleDeleteSocialMission(id: number) {
    if (!window.confirm(`Are you sure you want to delete this social mission?`)) return;
    try {
      const res = await adminFetch("/api/admin/social-missions", {
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

  function handleOpenEditSocialMission(mission: any) {
    setEditingSocialMission(mission);
    setEditSocialMissionForm({
      id: mission.id,
      platform: mission.platform || "facebook",
      title: mission.title || "",
      description: mission.description || "",
      url: mission.url || "",
      button_text: mission.button_text || "",
      button_color: mission.button_color || "#1877f2",
      sort_order: mission.sort_order || 0,
      is_active: mission.is_active !== false,
    });
  }

  async function handleUpdateSocialMission(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSocialMission) return;
    setIsUpdatingMission(true);
    try {
      const res = await fetch("/api/admin/social-missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSocialMissionForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update mission");

      setSocialMissions(prev => prev.map(m => m.id === editSocialMissionForm.id ? (json.mission || editSocialMissionForm) : m));
      setEditingSocialMission(null);
      alert("Social mission updated successfully!");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingMission(false);
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────────────
  const totalXpPool = quests.reduce((sum, q) => sum + (q.xp ?? 0), 0);
  const liveQuestCount = quests.filter((q) => q.status === "Live").length;

  // ─── Login gate ──────────────────────────────────────────────────────────
  if (!mounted) {
    return null;
  }

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
          <Link href="/shortcut" className="admin-back-link">← Back to Shortcut</Link>
        </div>
      </main>
    );
  }

  if (authed && showChangePasswordModal) {
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
          <h1>Change Temporary Password</h1>
          <p className="admin-login-hint">You are required to change your temporary password before accessing the dashboard.</p>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }} suppressHydrationWarning>
            <input
              type="password"
              placeholder="Current Password"
              value={changePasswordForm.oldPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, oldPassword: e.target.value })}
              className="admin-login-input"
              required
              suppressHydrationWarning
            />
            <input
              type="password"
              placeholder="New Password"
              value={changePasswordForm.newPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
              className="admin-login-input"
              required
              suppressHydrationWarning
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={changePasswordForm.confirmPassword}
              onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
              className="admin-login-input"
              required
              suppressHydrationWarning
            />
            {changePasswordError && <p className="admin-error-msg">{changePasswordError}</p>}
            <button type="submit" className="admin-login-btn" disabled={changePasswordLoading}>
              {changePasswordLoading ? "Updating..." : "Update Password"}
            </button>
            <button type="button" onClick={handleLogout} className="admin-login-btn" style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-color)", marginTop: 8 }}>
              Logout
            </button>
          </form>
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
          <a href="/shortcuts" className="admin-nav-link" style={{ borderColor: "rgba(59, 130, 246, 0.4)", color: "#60a5fa" }}>🧭 Shortcuts</a>
          <a href="/manual-presentation.html" target="_blank" rel="noreferrer" className="admin-nav-link" style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399" }}>📖 Manual ↗</a>
          <a href="/" className="admin-nav-link" onClick={(e) => handleNavigate(e, "/")}>Home Portal</a>
          <a href="/register" className="admin-nav-link" onClick={(e) => handleNavigate(e, "/register")}>Registration</a>
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
          if (role === "verifier") return t === "verifications" || t === "messages" || t === "questlog";
          if (role === "manage_attendees" || role === "manage_quester") return t === "scanner" || t === "attendees" || t === "questlog";
          if (role === "admin") return t === "scanner" || t === "attendees" || t === "quests" || t === "verifications" || t === "messages" || t === "questlog" || t === "booths";
          if (role === "viewer") return t === "scanner" || t === "attendees" || t === "quests" || t === "verifications" || t === "messages" || t === "questlog";
          return false;
        }).map((t) => (
          <button
            key={t}
            className={`admin-tab-btn${tab === t ? " admin-tab-btn--active" : ""}`}
            onClick={() => setTab(t)}
          >
            <span className="admin-tab-icon">
              {t === "scanner"
                ? "📷"
                : t === "attendees"
                  ? "🎫"
                  : t === "quests"
                    ? "⚡"
                    : t === "messages"
                      ? "💬"
                      : t === "questlog"
                        ? "📊"
                        : t === "booths"
                          ? "🏪"
                          : t === "staff"
                            ? "🛡️"
                            : t === "socials"
                              ? "📣"
                              : "🔍"}
            </span>
            <span className="admin-tab-text">
              {t === "scanner"
                ? " QR Scanner"
                : t === "attendees"
                  ? " Attendees"
                  : t === "quests"
                    ? " Event Quests"
                    : t === "messages"
                      ? ` Message Notes (${messageNotes.filter((v) => v.status === "Pending").length})`
                      : t === "questlog"
                        ? " Quest Log"
                        : t === "booths"
                          ? " Booth Stations"
                          : t === "staff"
                            ? " Staff / Admins"
                            : t === "socials"
                              ? " Social Missions"
                              : ` Quest Verifications (${verifications.filter((v) => !v.user_message && v.status === "Pending").length})`}
            </span>
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
                className={`admin-refresh-btn ${revealEmails ? "admin-refresh-btn--active" : ""}`}
                onClick={() => {
                  setRevealEmails((prev) => !prev);
                  setRevealedEmailIds(new Set());
                }}
                title={revealEmails ? "Hide / Mask all attendee emails" : "Reveal all attendee emails"}
                style={{
                  borderColor: revealEmails ? "rgba(245,166,35,0.6)" : undefined,
                  color: revealEmails ? "var(--gold-light)" : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {revealEmails ? "🙈 Mask Emails" : "📧 Reveal Emails"}
              </button>

              <button
                className={`admin-refresh-btn ${revealPhones ? "admin-refresh-btn--active" : ""}`}
                onClick={() => {
                  setRevealPhones((prev) => !prev);
                  setRevealedPhoneIds(new Set());
                }}
                title={revealPhones ? "Hide / Mask all attendee phone numbers" : "Reveal all attendee phone numbers"}
                style={{
                  borderColor: revealPhones ? "rgba(245,166,35,0.6)" : undefined,
                  color: revealPhones ? "var(--gold-light)" : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {revealPhones ? "🙈 Mask Phones" : "📱 Reveal Phones"}
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
                    <th>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Email</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRevealEmails((prev) => !prev);
                            setRevealedEmailIds(new Set());
                          }}
                          title={revealEmails ? "Mask all emails" : "Reveal all emails"}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "0.85rem",
                            opacity: 0.8,
                          }}
                        >
                          {revealEmails ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </th>
                    <th>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Phone</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRevealPhones((prev) => !prev);
                            setRevealedPhoneIds(new Set());
                          }}
                          title={revealPhones ? "Mask all phone numbers" : "Reveal all phone numbers"}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "0.85rem",
                            opacity: 0.8,
                          }}
                        >
                          {revealPhones ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </th>
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
                    paginatedAttendees.map((a, i) => {
                      const isEmailRevealed = revealEmails || revealedEmailIds.has(a.id);
                      const isPhoneRevealed = revealPhones || revealedPhoneIds.has(a.id);
                      return (
                        <tr key={a.id} className="admin-table__row">
                          <td className="admin-table__num">{attendeeStartIndex + i + 1}</td>
                          <td className="admin-table__name">{a.full_name}</td>
                          <td className="admin-table__email">
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span>{isEmailRevealed ? a.email : maskEmail(a.email)}</span>
                              <button
                                type="button"
                                onClick={() => toggleRevealEmail(a.id)}
                                title={isEmailRevealed ? "Hide email" : "Reveal email"}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  fontSize: "0.85rem",
                                  opacity: 0.7,
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                {isEmailRevealed ? "🙈" : "👁️"}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span>{isPhoneRevealed ? a.phone : maskPhone(a.phone)}</span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPhone(a.id)}
                                title={isPhoneRevealed ? "Hide phone" : "Reveal phone"}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  fontSize: "0.85rem",
                                  opacity: 0.7,
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                {isPhoneRevealed ? "🙈" : "👁️"}
                              </button>
                            </div>
                          </td>
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
                        <td style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {!a.checked_in && adminUser?.role !== "viewer" && (
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
                          {adminUser?.role !== "viewer" && (
                            <button
                              className="admin-refresh-btn"
                              onClick={() => openResetPinModal(a)}
                              title="Open Reset PIN Studio for attendee"
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                borderColor: "rgba(245, 166, 35, 0.4)",
                                color: "#fbbf24",
                              }}
                            >
                              🔑 Reset PIN
                            </button>
                          )}
                          {adminUser?.role === "superadmin" && (
                            <button
                              className="admin-delete-btn"
                              onClick={() => {
                                setDeletingAttendee(a);
                                setDeleteConfirmEmailInput("");
                              }}
                              title="Delete attendee and purge all quest records"
                              style={{
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                              }}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>

            {/* Attendees Pagination Bar */}
            {filteredAttendees.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16, padding: "8px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="admin-search-input"
                    style={{ width: "auto", padding: "4px 10px", fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ marginLeft: 8 }}>
                    Showing <strong>{filteredAttendees.length > 0 ? attendeeStartIndex + 1 : 0}</strong>–<strong>{Math.min(attendeeStartIndex + pageSize, filteredAttendees.length)}</strong> of <strong>{filteredAttendees.length}</strong>
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    className="admin-refresh-btn"
                    onClick={() => setAttendeePage((p) => Math.max(1, p - 1))}
                    disabled={safeAttendeePage <= 1}
                    style={{
                      opacity: safeAttendeePage <= 1 ? 0.4 : 1,
                      cursor: safeAttendeePage <= 1 ? "not-allowed" : "pointer",
                      padding: "6px 14px"
                    }}
                  >
                    ← Prev
                  </button>

                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--gold-light)", padding: "0 8px" }}>
                    Page {safeAttendeePage} of {totalAttendeePages}
                  </span>

                  <button
                    className="admin-refresh-btn"
                    onClick={() => setAttendeePage((p) => Math.min(totalAttendeePages, p + 1))}
                    disabled={safeAttendeePage >= totalAttendeePages}
                    style={{
                      opacity: safeAttendeePage >= totalAttendeePages ? 0.4 : 1,
                      cursor: safeAttendeePage >= totalAttendeePages ? "not-allowed" : "pointer",
                      padding: "6px 14px"
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

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

            {/* Reset PIN Studio Modal */}
            {resetPinAttendee && (
              <div className="admin-modal-overlay" onClick={() => setResetPinAttendee(null)} style={{ zIndex: 99999 }}>
                <div
                  className="quest-modal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: 420,
                    padding: 26,
                    background: "linear-gradient(145deg, #0e131f 0%, #172033 100%)",
                    border: "1px solid rgba(245, 166, 35, 0.4)",
                    borderRadius: 20,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.85), 0 0 30px rgba(245, 166, 35, 0.15)",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={() => setResetPinAttendee(null)}
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      background: "rgba(255,255,255,0.06)",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "1.1rem",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>

                  {!resetPinResult ? (
                    <>
                      <div style={{ textAlign: "center", marginBottom: 18 }}>
                        <div style={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          background: "rgba(245, 166, 35, 0.12)",
                          border: "1px solid rgba(245, 166, 35, 0.4)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.6rem",
                          marginBottom: 8
                        }}>
                          🔑
                        </div>
                        <h3 style={{ fontSize: "1.2rem", color: "#fbbf24", margin: 0, fontWeight: 800 }}>
                          Security PIN Reset Studio
                        </h3>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                          Issue a temporary Security PIN for the attendee
                        </p>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, marginBottom: 18, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                          👤 {resetPinAttendee.full_name}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                          📧 {resetPinAttendee.email}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                          🎫 Ticket: <span style={{ color: "var(--gold-light)", fontFamily: "monospace", fontWeight: 700 }}>{resetPinAttendee.ticket_code}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button
                          type="button"
                          disabled={isResettingPin}
                          onClick={() => handleExecuteResetPin(undefined)}
                          style={{
                            padding: "13px",
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                            border: "none",
                            color: "#000",
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            boxShadow: "0 8px 20px rgba(245, 166, 35, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8
                          }}
                        >
                          {isResettingPin ? "Generating..." : "⚡ Auto-Generate Random 4-Digit PIN"}
                        </button>

                        <div style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", margin: "2px 0" }}>
                          ── OR ENTER CUSTOM TEMPORARY PIN ──
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="e.g. 1234"
                            value={resetPinInput}
                            onChange={(e) => setResetPinInput(e.target.value.replace(/[^\d]/g, ""))}
                            style={{
                              flex: 1,
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "#080b12",
                              border: "1px solid rgba(245,166,35,0.4)",
                              color: "#fff",
                              letterSpacing: "4px",
                              fontWeight: "bold",
                              fontSize: "1.05rem",
                              textAlign: "center"
                            }}
                          />
                          <button
                            type="button"
                            disabled={isResettingPin || !resetPinInput}
                            onClick={() => handleExecuteResetPin(resetPinInput)}
                            style={{
                              padding: "10px 16px",
                              borderRadius: 10,
                              background: "rgba(255, 255, 255, 0.1)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              cursor: resetPinInput ? "pointer" : "not-allowed",
                              opacity: resetPinInput ? 1 : 0.5
                            }}
                          >
                            Set Custom PIN
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: 4 }}>🎉</div>
                      <h3 style={{ fontSize: "1.2rem", color: "#34d399", margin: "0 0 4px", fontWeight: 800 }}>
                        Temporary PIN Ready!
                      </h3>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
                        Share this temporary PIN with <strong>{resetPinAttendee.full_name}</strong>
                      </p>

                      <div style={{
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "2px dashed rgba(16, 185, 129, 0.4)",
                        borderRadius: 16,
                        padding: "16px",
                        marginBottom: 18,
                      }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                          Temporary Security PIN
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                          {resetPinResult.tempPin.split("").map((digit, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: 44,
                                height: 54,
                                borderRadius: 10,
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#fff",
                                fontSize: "1.7rem",
                                fontWeight: 900,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 6px 16px rgba(16, 185, 129, 0.4)"
                              }}
                            >
                              {digit}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(resetPinResult.tempPin);
                            setCopiedPinToast(true);
                            setTimeout(() => setCopiedPinToast(false), 2500);
                          }}
                          style={{
                            padding: "12px",
                            borderRadius: 10,
                            background: copiedPinToast ? "rgba(16, 185, 129, 0.25)" : "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: copiedPinToast ? "#34d399" : "#fff",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6
                          }}
                        >
                          {copiedPinToast ? "✓ Copied PIN to Clipboard!" : "📋 Copy Temporary PIN"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setResetPinAttendee(null)}
                          style={{
                            padding: "11px",
                            borderRadius: 10,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "none",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer"
                          }}
                        >
                          Done & Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delete Attendee Modal (Superadmin Only) */}
            {deletingAttendee && (
              <div className="admin-modal-overlay" onClick={() => setDeletingAttendee(null)} style={{ zIndex: 99999 }}>
                <div className="quest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 6 }}>⚠️</div>
                  <h3 style={{ color: "#ef4444", margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 800 }}>
                    Delete Attendee & Purge Records
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem", marginBottom: 14, lineHeight: 1.5 }}>
                    Are you sure you want to permanently delete <strong>{deletingAttendee.full_name}</strong>?
                  </p>
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 12, textAlign: "left", fontSize: "0.78rem", color: "#f87171", marginBottom: 14 }}>
                    <strong>This action will permanently delete:</strong>
                    <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                      <li>Attendee Registration & Ticket Code (<code>{deletingAttendee.ticket_code}</code>)</li>
                      <li>All Claimed Quests & Total XP balance</li>
                      <li>All Screenshot Proof submissions & Message Notes</li>
                    </ul>
                  </div>

                  <div style={{ marginBottom: 18, textAlign: "left" }}>
                    <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      Type attendee email <code style={{ color: "#f87171", fontWeight: "bold" }}>{deletingAttendee.email}</code> to confirm:
                    </label>
                    <input
                      type="text"
                      placeholder={`Type ${deletingAttendee.email}`}
                      value={deleteConfirmEmailInput}
                      onChange={(e) => setDeleteConfirmEmailInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "#080b12",
                        border: deleteConfirmEmailInput.trim().toLowerCase() === deletingAttendee.email.trim().toLowerCase()
                          ? "1px solid #10b981"
                          : "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#fff",
                        fontSize: "0.85rem",
                        textAlign: "center"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button
                      className="admin-delete-btn"
                      onClick={() => setDeletingAttendee(null)}
                      style={{ padding: "9px 18px", background: "rgba(255,255,255,0.1)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      Cancel
                    </button>
                    <button
                      className="admin-delete-btn"
                      onClick={handleConfirmDeleteAttendee}
                      disabled={isDeletingAttendee || deleteConfirmEmailInput.trim().toLowerCase() !== deletingAttendee.email.trim().toLowerCase()}
                      style={{
                        padding: "9px 18px",
                        background: deleteConfirmEmailInput.trim().toLowerCase() === deletingAttendee.email.trim().toLowerCase() ? "#ef4444" : "rgba(239, 68, 68, 0.2)",
                        color: deleteConfirmEmailInput.trim().toLowerCase() === deletingAttendee.email.trim().toLowerCase() ? "#fff" : "rgba(255,255,255,0.4)",
                        borderColor: deleteConfirmEmailInput.trim().toLowerCase() === deletingAttendee.email.trim().toLowerCase() ? "#dc2626" : "rgba(239, 68, 68, 0.3)",
                        fontWeight: "bold",
                        cursor: deleteConfirmEmailInput.trim().toLowerCase() === deletingAttendee.email.trim().toLowerCase() ? "pointer" : "not-allowed"
                      }}
                    >
                      {isDeletingAttendee ? "Deleting..." : "🗑️ Delete Permanently"}
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
                <option value="quiz">❓ Quiz</option>
                <option value="atfx">📈 ATFX</option>
              </select>

              {/* ④ Verification Mode Filter */}
              <select
                value={questVerificationModeFilter}
                onChange={(e) => setQuestVerificationModeFilter(e.target.value as any)}
                className="admin-search-input"
                style={{
                  width: "auto",
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderColor: questVerificationModeFilter !== "all" ? "rgba(245, 166, 35, 0.6)" : undefined,
                  fontWeight: questVerificationModeFilter !== "all" ? 700 : 400,
                }}
              >
                <option value="all">⚡ All Verification Modes</option>
                <option value="instant">⚡ Instant Claim</option>
                <option value="proof_only">📷 Screenshot Proof</option>
                <option value="message_only">💬 Messagebox Note</option>
                <option value="photo_and_message">📸+💬 Photo + Message</option>
                <option value="quiz">❓ Quiz Question</option>
                <option value="passcode">🔑 Secret Passcode</option>
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
                    <th>Creator / Editor</th>
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
                    filteredQuests.slice((questPage - 1) * questPageSize, (questPage - 1) * questPageSize + questPageSize).map((q) => (
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
                        <td style={{ fontSize: "0.72rem", lineHeight: "1.3" }}>
                          <div>
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>Created:</span>{" "}
                            <span style={{ fontWeight: 600, color: "#fff" }}>
                              {(() => {
                                const creator = q.created_by || "System";
                                const matched = adminUsersList.find((u) => u.email?.toLowerCase() === creator.toLowerCase());
                                return matched?.fullName || creator;
                              })()}
                            </span>{" "}
                            <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>
                              ({new Date(q.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })})
                            </span>
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>Edited:</span>{" "}
                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                              {(() => {
                                const editor = q.updated_by || "System";
                                const matched = adminUsersList.find((u) => u.email?.toLowerCase() === editor.toLowerCase());
                                return matched?.fullName || editor;
                              })()}
                            </span>{" "}
                            <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>
                              {q.updated_at ? `(${new Date(q.updated_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })})` : "—"}
                            </span>
                          </div>
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

            <PaginationBar
              currentPage={questPage}
              pageSize={questPageSize}
              totalItems={filteredQuests.length}
              onPageChange={setQuestPage}
              onPageSizeChange={setQuestPageSize}
            />

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
            {/* Compact Live Status Filters / Metric Pills */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14
            }}>
              {/* All / Total Pill */}
              <button
                type="button"
                onClick={() => setVerificationStatusFilter("all")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: verificationStatusFilter === "all" ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.6)",
                  border: verificationStatusFilter === "all" ? "1px solid rgba(255, 255, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  boxShadow: verificationStatusFilter === "all" ? "0 0 10px rgba(255, 255, 255, 0.15)" : "none"
                }}
              >
                <span>📊 All</span>
                <span style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem"
                }}>
                  {verifications.length}
                </span>
              </button>

              {/* Pending Pill */}
              <button
                type="button"
                onClick={() => setVerificationStatusFilter("Pending")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: verificationStatusFilter === "Pending" ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.08)",
                  border: verificationStatusFilter === "Pending" ? "1px solid rgba(245, 158, 11, 0.8)" : "1px solid rgba(245, 158, 11, 0.25)",
                  color: "#fbbf24",
                  boxShadow: verificationStatusFilter === "Pending" ? "0 0 12px rgba(245, 158, 11, 0.3)" : "none"
                }}
              >
                <span>⏳ Pending</span>
                <span style={{
                  background: "rgba(245, 158, 11, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#fef3c7"
                }}>
                  {verifications.filter((v) => v.status === "Pending").length}
                </span>
              </button>

              {/* Approved Pill */}
              <button
                type="button"
                onClick={() => setVerificationStatusFilter("Approved")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: verificationStatusFilter === "Approved" ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.08)",
                  border: verificationStatusFilter === "Approved" ? "1px solid rgba(16, 185, 129, 0.8)" : "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34d399",
                  boxShadow: verificationStatusFilter === "Approved" ? "0 0 12px rgba(16, 185, 129, 0.3)" : "none"
                }}
              >
                <span>✓ Approved</span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#d1fae5"
                }}>
                  {verifications.filter((v) => v.status === "Approved").length}
                </span>
              </button>

              {/* Rejected Pill */}
              <button
                type="button"
                onClick={() => setVerificationStatusFilter("Rejected")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: verificationStatusFilter === "Rejected" ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.08)",
                  border: verificationStatusFilter === "Rejected" ? "1px solid rgba(239, 68, 68, 0.8)" : "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                  boxShadow: verificationStatusFilter === "Rejected" ? "0 0 12px rgba(239, 68, 68, 0.3)" : "none"
                }}
              >
                <span>✕ Rejected</span>
                <span style={{
                  background: "rgba(239, 68, 68, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#fee2e2"
                }}>
                  {verifications.filter((v) => v.status === "Rejected").length}
                </span>
              </button>
            </div>

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

              <select
                value={verificationCategoryFilter}
                onChange={(e) => setVerificationCategoryFilter(e.target.value)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer" }}
              >
                <option value="all">All Categories</option>
                <option value="onboarding">🚀 Onboarding</option>
                <option value="social">📣 Social</option>
                <option value="daily">📅 Daily</option>
                <option value="quiz">❓ Quiz</option>
                <option value="atfx">📈 ATFX</option>
              </select>

              {/* Verification Mode Filter */}
              <select
                value={verificationModeFilter}
                onChange={(e) => setVerificationModeFilter(e.target.value as any)}
                className="admin-search-input"
                style={{ width: "auto", padding: "8px 12px", cursor: "pointer", borderColor: verificationModeFilter !== "all" ? "rgba(245, 166, 35, 0.6)" : undefined }}
              >
                <option value="all">📁 All Modes ({verifications.length})</option>
                <option value="photo_only">📷 Screenshot Proof Only ({verifications.filter((v) => !v.user_message).length})</option>
                <option value="photo_and_message">📸+💬 Photo + Message ({verifications.filter((v) => !!v.user_message).length})</option>
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

              <button
                className="admin-refresh-btn"
                onClick={exportVerificationsToCSV}
                title="Export currently filtered quest verifications to CSV"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.4)",
                  color: "#34d399",
                }}
              >
                📥 Export CSV ({filteredVerifications.length})
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
                    filteredVerifications.slice((verificationPage - 1) * verificationPageSize, (verificationPage - 1) * verificationPageSize + verificationPageSize).map((v, i) => (
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
                          {v.proof_url && v.proof_url !== "Text Submission" ? (
                            <div
                              onClick={() => setSelectedProofImage(v.proof_url)}
                              style={{ cursor: "pointer", display: "inline-block" }}
                              title="Click to view full screenshot proof"
                            >
                              <img
                                src={v.proof_url}
                                alt="Proof thumbnail"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%231e1e2e'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' font-size='22'>🖼️</text><text x='50%' y='70%' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-size='9' font-family='sans-serif' font-weight='bold'>Image Error</text></svg>";
                                }}
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
                            <span className="admin-table__muted" style={{ fontSize: "0.75rem" }}>💬 Text Only</span>
                          )}
                          {v.user_message && (
                            <details style={{ marginTop: 8, maxWidth: 240 }}>
                              <summary style={{
                                padding: "4px 8px",
                                background: "rgba(245, 166, 35, 0.15)",
                                border: "1px solid rgba(245, 166, 35, 0.3)",
                                borderRadius: 6,
                                fontSize: "0.75rem",
                                color: "#fbbf24",
                                cursor: "pointer",
                                userSelect: "none",
                                fontWeight: 600,
                                display: "inline-block"
                              }}>
                                💬 View Message
                              </summary>
                              <div style={{
                                marginTop: 6,
                                padding: "8px 10px",
                                background: "rgba(0, 0, 0, 0.25)",
                                border: "1px solid rgba(245, 166, 35, 0.15)",
                                borderRadius: 6,
                                fontSize: "0.8rem",
                                color: "#fff",
                                wordBreak: "break-word"
                              }}>
                                "{v.user_message}"
                              </div>
                            </details>
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
                            <div>
                              <span className="admin-status-badge admin-status-badge--live">✓ Approved</span>
                              {v.approved_by && (
                                <div style={{ fontSize: "0.68rem", color: "#60a5fa", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <span>👮</span> {v.approved_by}
                                </div>
                              )}
                            </div>
                          ) : v.status === "Rejected" ? (
                            <div>
                              <span className="admin-status-badge admin-status-badge--done" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                ✕ Rejected
                              </span>
                              {v.approved_by && (
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>
                                  by {v.approved_by}
                                </div>
                              )}
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
                          {adminUser?.role === "viewer" ? (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Read-only</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <button
                                className="admin-edit-btn"
                                onClick={() => {
                                  setActionModalVerification(v);
                                  setVerificationActionReason(v.rejection_reason || "");
                                }}
                                style={{
                                  background: v.status === "Pending"
                                    ? "linear-gradient(135deg, rgba(245, 166, 35, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)"
                                    : v.status === "Approved"
                                    ? "rgba(16, 185, 129, 0.18)"
                                    : "rgba(239, 68, 68, 0.18)",
                                  borderColor: v.status === "Pending"
                                    ? "rgba(245, 166, 35, 0.6)"
                                    : v.status === "Approved"
                                    ? "rgba(16, 185, 129, 0.4)"
                                    : "rgba(239, 68, 68, 0.4)",
                                  color: v.status === "Pending"
                                    ? "#fbbf24"
                                    : v.status === "Approved"
                                    ? "#34d399"
                                    : "#f87171",
                                  padding: "6px 14px",
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6
                                }}
                                title="Open Quest Verification Action Modal"
                              >
                                {v.status === "Pending" ? "⚡ Review & Action" : v.status === "Approved" ? "✓ Edit Action" : "✕ Edit Action"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={verificationPage}
              pageSize={verificationPageSize}
              totalItems={filteredVerifications.length}
              onPageChange={setVerificationPage}
              onPageSizeChange={setVerificationPageSize}
            />
          </>
        )}

        {/* ─── MESSAGES TAB ─── */}
        {tab === "messages" && !loading && (
          <>
            {/* Compact Live Status Filters / Metric Pills */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14
            }}>
              {/* All / Total Pill */}
              <button
                type="button"
                onClick={() => setMessageStatusFilter("all")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: messageStatusFilter === "all" ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.6)",
                  border: messageStatusFilter === "all" ? "1px solid rgba(255, 255, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  boxShadow: messageStatusFilter === "all" ? "0 0 10px rgba(255, 255, 255, 0.15)" : "none"
                }}
              >
                <span>💬 All</span>
                <span style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem"
                }}>
                  {messageNotes.length}
                </span>
              </button>

              {/* Pending Pill */}
              <button
                type="button"
                onClick={() => setMessageStatusFilter("Pending")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: messageStatusFilter === "Pending" ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.08)",
                  border: messageStatusFilter === "Pending" ? "1px solid rgba(245, 158, 11, 0.8)" : "1px solid rgba(245, 158, 11, 0.25)",
                  color: "#fbbf24",
                  boxShadow: messageStatusFilter === "Pending" ? "0 0 12px rgba(245, 158, 11, 0.3)" : "none"
                }}
              >
                <span>⏳ Pending</span>
                <span style={{
                  background: "rgba(245, 158, 11, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#fef3c7"
                }}>
                  {messageNotes.filter((m) => m.status === "Pending").length}
                </span>
              </button>

              {/* Approved Pill */}
              <button
                type="button"
                onClick={() => setMessageStatusFilter("Approved")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: messageStatusFilter === "Approved" ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.08)",
                  border: messageStatusFilter === "Approved" ? "1px solid rgba(16, 185, 129, 0.8)" : "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34d399",
                  boxShadow: messageStatusFilter === "Approved" ? "0 0 12px rgba(16, 185, 129, 0.3)" : "none"
                }}
              >
                <span>✓ Approved</span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#d1fae5"
                }}>
                  {messageNotes.filter((m) => m.status === "Approved").length}
                </span>
              </button>

              {/* Rejected Pill */}
              <button
                type="button"
                onClick={() => setMessageStatusFilter("Rejected")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: messageStatusFilter === "Rejected" ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.08)",
                  border: messageStatusFilter === "Rejected" ? "1px solid rgba(239, 68, 68, 0.8)" : "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#f87171",
                  boxShadow: messageStatusFilter === "Rejected" ? "0 0 12px rgba(239, 68, 68, 0.3)" : "none"
                }}
              >
                <span>✕ Rejected</span>
                <span style={{
                  background: "rgba(239, 68, 68, 0.25)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: "0.76rem",
                  color: "#fee2e2"
                }}>
                  {messageNotes.filter((m) => m.status === "Rejected").length}
                </span>
              </button>
            </div>

            <div className="admin-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
              <input
                type="search"
                placeholder="Search messages by text, quester name, email or quest title..."
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                className="admin-search-input"
                style={{ flex: 1, minWidth: 260 }}
              />

              <select
                className="admin-filter-select"
                value={messageStatusFilter}
                onChange={(e) => setMessageStatusFilter(e.target.value as any)}
              >
                <option value="all">All Message Statuses</option>
                <option value="Pending">⏳ Pending Only</option>
                <option value="Approved">✓ Approved Only</option>
                <option value="Rejected">✕ Rejected Only</option>
              </select>

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

              <button className="admin-refresh-btn" onClick={fetchMessageNotes} title="Refresh Messages">
                ↻ Refresh
              </button>

              <button
                className="admin-refresh-btn"
                onClick={exportMessageNotesToCSV}
                title="Export currently filtered message notes to CSV"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.4)",
                  color: "#34d399",
                }}
              >
                📥 Export CSV ({filteredMessageVerifications.length})
              </button>
            </div>

            <div className="admin-table-wrapper">
              <div className="admin-table-header" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: "1.15rem", margin: 0, color: "var(--gold-light)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💬</span> Attendee Message Notes ({filteredMessageVerifications.length})
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Showing text notes submitted by questers
                </span>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>👤 Quester</th>
                    <th>⚡ Quest</th>
                    <th>💬 Messagebox Note</th>
                    <th>📅 Submitted</th>
                    <th>🏷️ Status</th>
                    <th>⚙️ Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessageVerifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-table__empty">
                        💬 No attendee message notes found.
                      </td>
                    </tr>
                  ) : (
                    filteredMessageVerifications.slice((messagePage - 1) * messagePageSize, (messagePage - 1) * messagePageSize + messagePageSize).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>{v.user_name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{v.user_email}</div>
                          {v.ticket_code && (
                            <div style={{ fontSize: "0.72rem", color: "var(--gold-light)", marginTop: 2 }}>
                              🎫 {v.ticket_code}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "#c084fc", fontSize: "0.9rem" }}>⚡ {v.quest_title}</div>
                          <span className="admin-xp-badge" style={{ marginTop: 4, display: "inline-block" }}>+{v.xp} XP</span>
                        </td>
                        <td>
                          <div style={{
                            background: "radial-gradient(ellipse at 50% 0%, rgba(245, 166, 35, 0.14) 0%, rgba(14, 19, 31, 0.95) 100%)",
                            border: "1px solid rgba(245, 166, 35, 0.4)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            color: "#f8fafc",
                            fontSize: "0.88rem",
                            lineHeight: 1.5,
                            maxWidth: 380,
                            wordBreak: "break-word",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.3)"
                          }}>
                            💬 "{v.user_message}"
                          </div>
                          {v.proof_url && (v.proof_url.startsWith("http") || v.proof_url.startsWith("data:image/")) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                              <img
                                src={v.proof_url}
                                alt="Attached screenshot"
                                style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)" }}
                                onClick={() => setSelectedProofImage(v.proof_url)}
                              />
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                📷 Photo Attached
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="admin-table__muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                          {new Date(v.created_at).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          {v.status === "Approved" ? (
                            <div>
                              <span className="admin-status-badge admin-status-badge--live">✓ Approved</span>
                              {v.approved_by && (
                                <div style={{ fontSize: "0.68rem", color: "#60a5fa", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <span>👮</span> {v.approved_by}
                                </div>
                              )}
                            </div>
                          ) : v.status === "Rejected" ? (
                            <div>
                              <span className="admin-status-badge admin-status-badge--done" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                ✕ Rejected
                              </span>
                              {v.approved_by && (
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>
                                  by {v.approved_by}
                                </div>
                              )}
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
                          {adminUser?.role === "viewer" ? (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Read-only</span>
                          ) : (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <button
                                className="admin-edit-btn"
                                onClick={() => handleVerifyMessage(v.id, "Approved")}
                                style={{
                                  background: v.status === "Approved" ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.15)",
                                  borderColor: "rgba(16, 185, 129, 0.4)",
                                  color: "#34d399",
                                  padding: "6px 12px",
                                  fontSize: "0.78rem",
                                  cursor: "pointer"
                                }}
                              >
                                {v.status === "Approved" ? "✓ Approved" : "✓ Approve"}
                              </button>
                              <button
                                className="admin-delete-btn"
                                onClick={() => {
                                  setRejectingItem(v);
                                  setRejectionReasonInput(v.rejection_reason || "");
                                }}
                                style={{
                                  background: v.status === "Rejected" ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.15)",
                                  borderColor: "rgba(239, 68, 68, 0.4)",
                                  color: "#ef4444",
                                  padding: "6px 12px",
                                  fontSize: "0.78rem",
                                  cursor: "pointer"
                                }}
                              >
                                {v.status === "Rejected" ? "✕ Rejected" : "✕ Reject"}
                              </button>
                              {v.status !== "Pending" && (
                                <button
                                  className="admin-refresh-btn"
                                  onClick={() => handleVerifyMessage(v.id, "Pending")}
                                  title="Reset status back to Pending"
                                  style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                                >
                                  🔄 Reset
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={messagePage}
              pageSize={messagePageSize}
              totalItems={filteredMessageVerifications.length}
              onPageChange={setMessagePage}
              onPageSizeChange={setMessagePageSize}
            />
          </>
        )}

        {/* ─── QUEST LOG (CUSTOMIZABLE REPORTING TABLE) TAB ─── */}
        {tab === "questlog" && !loading && (() => {
          // Combine verifications and message notes into a single master audit log
          const allLogs = [
            ...verifications.map((v) => ({ ...v, logType: "Screenshot Proof" })),
            ...messageNotes.map((m) => ({ ...m, logType: "Messagebox Note" })),
          ];

          const filteredLogs = allLogs.filter((item) => {
            const query = questLogSearch.toLowerCase();
            const matchesQuery =
              !query ||
              (item.user_name || "").toLowerCase().includes(query) ||
              (item.user_email || "").toLowerCase().includes(query) ||
              (item.quest_title || "").toLowerCase().includes(query) ||
              (item.ticket_code || "").toLowerCase().includes(query);

            if (!matchesQuery) return false;
            if (questLogStatusFilter !== "all" && item.status !== questLogStatusFilter) return false;
            const questCategory = quests.find(q => q.id === item.quest_id)?.category || "other";
            if (questLogCategoryFilter !== "all" && questCategory !== questLogCategoryFilter) return false;
            return true;
          });

          const exportToCSV = () => {
            const headers = ["Quester Name", "Email", "Ticket Code", "Quest Title", "XP", "Type", "Status", "Reviewed By", "Date"];
            const rows = filteredLogs.map((item) => [
              `"${item.user_name || ""}"`,
              `"${item.user_email || ""}"`,
              `"${item.ticket_code || ""}"`,
              `"${item.quest_title || ""}"`,
              item.xp || 0,
              `"${item.logType}"`,
              `"${item.status}"`,
              `"${item.approved_by || (item.status === "Approved" ? "Admin" : "N/A")}"`,
              `"${new Date(item.created_at).toLocaleString()}"`,
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Quest_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          return (
            <>
              <div className="admin-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Search Quest Log (Name, Email, Title, Reviewer)..."
                    value={questLogSearch}
                    onChange={(e) => setQuestLogSearch(e.target.value)}
                    className="admin-search-input"
                    style={{ minWidth: 260 }}
                  />
                  <select
                    value={questLogStatusFilter}
                    onChange={(e) => setQuestLogStatusFilter(e.target.value)}
                    className="admin-select-filter"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <select
                    value={questLogCategoryFilter}
                    onChange={(e) => setQuestLogCategoryFilter(e.target.value)}
                    className="admin-select-filter"
                  >
                    <option value="all">All Categories</option>
                    <option value="onboarding">🚀 Onboarding</option>
                    <option value="social">📣 Social</option>
                    <option value="daily">📅 Daily</option>
                    <option value="quiz">❓ Quiz</option>
                    <option value="atfx">📈 ATFX</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      setRevealQuestLogEmails((prev) => !prev);
                      setRevealedQuestLogKeys(new Set());
                    }}
                    className={`admin-refresh-btn ${revealQuestLogEmails ? "admin-refresh-btn--active" : ""}`}
                    title={revealQuestLogEmails ? "Hide / Mask all emails in Quest Log" : "Reveal all emails in Quest Log"}
                    style={{
                      borderColor: revealQuestLogEmails ? "rgba(245,166,35,0.6)" : undefined,
                      color: revealQuestLogEmails ? "var(--gold-light)" : undefined,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    {revealQuestLogEmails ? "🙈 Mask Emails" : "📧 Reveal Emails"}
                  </button>

                  <button
                    onClick={exportToCSV}
                    className="admin-action-btn"
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      fontWeight: 800,
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    📥 Export Report (CSV)
                  </button>
                  <button
                    onClick={() => {
                      fetchVerifications();
                      fetchMessageNotes();
                    }}
                    className="admin-refresh-btn"
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {/* Column Customizer Panel */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(245, 166, 35, 0.25)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap"
              }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--gold-light)" }}>
                  ⚙️ Customizable Columns:
                </span>
                {Object.keys(visibleColumns).map((col) => (
                  <label key={col} style={{ fontSize: "0.8rem", color: "#fff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={(visibleColumns as any)[col]}
                      onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                    />
                    {col.toUpperCase()}
                  </label>
                ))}
              </div>

              {/* Master Audit Table */}
              <div className="admin-table-wrapper">
                <div className="admin-table-header" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: "1.15rem", margin: 0, color: "var(--gold-light)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📊</span> Master Quest Audit & Activity Log ({filteredLogs.length})
                  </h2>
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      {visibleColumns.quester && <th>👤 Quester Name</th>}
                      {visibleColumns.email && (
                        <th>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>📧 Email</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRevealQuestLogEmails((prev) => !prev);
                                setRevealedQuestLogKeys(new Set());
                              }}
                              title={revealQuestLogEmails ? "Mask all emails" : "Reveal all emails"}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "0.85rem",
                                opacity: 0.8,
                              }}
                            >
                              {revealQuestLogEmails ? "🙈" : "👁️"}
                            </button>
                          </div>
                        </th>
                      )}
                      {visibleColumns.ticket && <th>🎫 Ticket</th>}
                      {visibleColumns.quest && <th>⚡ Quest Title</th>}
                      {visibleColumns.xp && <th>⭐ XP</th>}
                      {visibleColumns.type && <th>🏷️ Type</th>}
                      {visibleColumns.status && <th>📌 Status</th>}
                      {visibleColumns.reviewer && <th>👮 Reviewed / Approved By</th>}
                      {visibleColumns.date && <th>📅 Date Submitted</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="admin-table__empty">
                          📊 No log entries found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.slice((questLogPage - 1) * questLogPageSize, (questLogPage - 1) * questLogPageSize + questLogPageSize).map((item) => {
                        const logKey = `${item.logType}-${item.id}`;
                        const isLogEmailRevealed = revealQuestLogEmails || revealedQuestLogKeys.has(logKey);
                        return (
                          <tr key={logKey}>
                            {visibleColumns.quester && <td style={{ fontWeight: 700, color: "#fff" }}>{item.user_name}</td>}
                            {visibleColumns.email && (
                              <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>{isLogEmailRevealed ? item.user_email : maskEmail(item.user_email)}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealQuestLogEmail(logKey)}
                                    title={isLogEmailRevealed ? "Hide email" : "Reveal email"}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      fontSize: "0.85rem",
                                      opacity: 0.7,
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    {isLogEmailRevealed ? "🙈" : "👁️"}
                                  </button>
                                </div>
                              </td>
                            )}
                          {visibleColumns.ticket && <td style={{ color: "var(--gold-light)", fontSize: "0.82rem" }}>{item.ticket_code || "N/A"}</td>}
                          {visibleColumns.quest && <td style={{ fontWeight: 700, color: "#c084fc" }}>{item.quest_title}</td>}
                          {visibleColumns.xp && <td><span className="admin-xp-badge">+{item.xp} XP</span></td>}
                          {visibleColumns.type && (
                            <td>
                              <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "#e2e8f0" }}>
                                {item.logType}
                              </span>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td>
                              <span className={`admin-status-badge ${item.status === "Approved" ? "admin-status-badge--live" : item.status === "Rejected" ? "admin-status-badge--done" : "admin-status-badge--soon"}`}>
                                {item.status}
                              </span>
                            </td>
                          )}
                          {visibleColumns.reviewer && (
                            <td>
                              {item.approved_by ? (
                                <span style={{
                                  fontSize: "0.76rem",
                                  padding: "3px 8px",
                                  borderRadius: 8,
                                  background: "rgba(59, 130, 246, 0.15)",
                                  color: "#60a5fa",
                                  border: "1px solid rgba(59, 130, 246, 0.3)",
                                  fontWeight: 600,
                                  display: "inline-block"
                                }}>
                                  👮 {item.approved_by}
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                  {item.status === "Pending" ? "⏳ Pending Review" : "—"}
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.date && (
                            <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                              {new Date(item.created_at).toLocaleString()}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                currentPage={questLogPage}
                pageSize={questLogPageSize}
                totalItems={filteredLogs.length}
                onPageChange={setQuestLogPage}
                onPageSizeChange={setQuestLogPageSize}
              />
            </>
          );
        })()}

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
                    adminUsersList.filter(u => u.role !== 'booth_staff').slice((staffPage - 1) * staffPageSize, (staffPage - 1) * staffPageSize + staffPageSize).map(user => (
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
              <PaginationBar
                currentPage={staffPage}
                pageSize={staffPageSize}
                totalItems={adminUsersList.filter(u => u.role !== 'booth_staff').length}
                onPageChange={setStaffPage}
                onPageSizeChange={setStaffPageSize}
              />
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
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {socialMissions.length === 0 ? (
                    <tr><td colSpan={6} className="admin-table__empty">No social missions found.</td></tr>
                  ) : (
                    socialMissions.slice((socialPage - 1) * socialPageSize, (socialPage - 1) * socialPageSize + socialPageSize).map(mission => (
                      <tr key={mission.id} className="admin-table__row" style={{ opacity: mission.is_active === false ? 0.65 : 1 }}>
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
                          {mission.is_active === false ? (
                            <span className="admin-status-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" }}>
                              🙈 Hidden
                            </span>
                          ) : (
                            <span className="admin-status-badge admin-status-badge--live">
                              👁️ Active
                            </span>
                          )}
                        </td>
                        <td style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            className="admin-refresh-btn"
                            onClick={() => handleToggleSocialMissionActive(mission)}
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.75rem",
                              borderColor: mission.is_active === false ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)",
                              color: mission.is_active === false ? "#34d399" : "#fbbf24"
                            }}
                          >
                            {mission.is_active === false ? "👁️ Show" : "🙈 Hide"}
                          </button>
                          <button
                            className="admin-edit-btn"
                            onClick={() => handleOpenEditSocialMission(mission)}
                          >
                            Edit
                          </button>
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
              <PaginationBar
                currentPage={socialPage}
                pageSize={socialPageSize}
                totalItems={socialMissions.length}
                onPageChange={setSocialPage}
                onPageSizeChange={setSocialPageSize}
              />
            </div>

            {/* Add Mission Form (Modal) */}
            {showAddMissionModal && (
              <div className="admin-modal-overlay" onClick={() => setShowAddMissionModal(false)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                  <div className="admin-modal__header" style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📣</span> Add Social Mission
                    </h2>
                    <button className="admin-modal__close" onClick={() => setShowAddMissionModal(false)}>✕</button>
                  </div>

                  <form onSubmit={handleCreateSocialMission} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <label className="qf-label">
                      Platform Type *
                      <select
                        className="qf-input"
                        value={newSocialMissionForm.platform}
                        onChange={(e) => setNewSocialMissionForm(f => ({ ...f, platform: e.target.value }))}
                        style={{ padding: "12px", cursor: "pointer", background: "#0e131f", color: "#fff" }}
                      >
                        <option value="facebook">Facebook</option>
                        <option value="telegram">Telegram</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="discord">Discord</option>
                        <option value="globe">Website / Other</option>
                      </select>
                    </label>

                    <label className="qf-label">
                      Mission Title *
                      <input
                        type="text"
                        required
                        placeholder="e.g. Follow BlockQuest on Facebook"
                        className="qf-input"
                        value={newSocialMissionForm.title}
                        onChange={(e) => setNewSocialMissionForm(f => ({ ...f, title: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Description *
                      <input
                        type="text"
                        required
                        placeholder="e.g. Follow our official page for updates"
                        className="qf-input"
                        value={newSocialMissionForm.description}
                        onChange={(e) => setNewSocialMissionForm(f => ({ ...f, description: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Target URL *
                      <input
                        type="url"
                        required
                        placeholder="https://facebook.com/..."
                        className="qf-input"
                        value={newSocialMissionForm.url}
                        onChange={(e) => setNewSocialMissionForm(f => ({ ...f, url: e.target.value }))}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <label className="qf-label">
                        Button Text *
                        <input
                          type="text"
                          required
                          placeholder="e.g. Follow FB →"
                          className="qf-input"
                          value={newSocialMissionForm.button_text}
                          onChange={(e) => setNewSocialMissionForm(f => ({ ...f, button_text: e.target.value }))}
                        />
                      </label>

                      <label className="qf-label">
                        Button Color (Hex) *
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <span style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: newSocialMissionForm.button_color || "#1877f2",
                            border: "2px solid rgba(255,255,255,0.2)",
                            flexShrink: 0
                          }} />
                          <input
                            type="text"
                            required
                            placeholder="#1877f2"
                            className="qf-input"
                            style={{ flex: 1 }}
                            value={newSocialMissionForm.button_color}
                            onChange={(e) => setNewSocialMissionForm(f => ({ ...f, button_color: e.target.value }))}
                          />
                        </div>
                      </label>
                    </div>

                    <label className="qf-label">
                      Sort Order
                      <input
                        type="number"
                        required
                        className="qf-input"
                        value={newSocialMissionForm.sort_order}
                        onChange={(e) => setNewSocialMissionForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      />
                    </label>

                    <div className="admin-modal__footer" style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button type="button" className="admin-cancel-btn" onClick={() => setShowAddMissionModal(false)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="admin-save-btn"
                        style={{
                          background: "linear-gradient(135deg, #1877f2, #0056b3)",
                          color: "#fff",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: 8,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        disabled={isCreatingMission}
                      >
                        {isCreatingMission ? "Creating..." : "Save Mission"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Mission Form (Modal) */}
            {editingSocialMission && (
              <div className="admin-modal-overlay" onClick={() => setEditingSocialMission(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                  <div className="admin-modal__header" style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>✏️</span> Edit Social Mission
                    </h2>
                    <button className="admin-modal__close" onClick={() => setEditingSocialMission(null)}>✕</button>
                  </div>

                  <form onSubmit={handleUpdateSocialMission} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <label className="qf-label">
                      Platform Type *
                      <select
                        className="qf-input"
                        value={editSocialMissionForm.platform}
                        onChange={(e) => setEditSocialMissionForm(f => ({ ...f, platform: e.target.value }))}
                        style={{ padding: "12px", cursor: "pointer", background: "#0e131f", color: "#fff" }}
                      >
                        <option value="facebook">Facebook</option>
                        <option value="telegram">Telegram</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="discord">Discord</option>
                        <option value="globe">Website / Other</option>
                      </select>
                    </label>

                    <label className="qf-label">
                      Mission Title *
                      <input
                        type="text"
                        required
                        placeholder="e.g. Follow BlockQuest on Facebook"
                        className="qf-input"
                        value={editSocialMissionForm.title}
                        onChange={(e) => setEditSocialMissionForm(f => ({ ...f, title: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Description *
                      <input
                        type="text"
                        required
                        placeholder="e.g. Follow our official page for updates"
                        className="qf-input"
                        value={editSocialMissionForm.description}
                        onChange={(e) => setEditSocialMissionForm(f => ({ ...f, description: e.target.value }))}
                      />
                    </label>

                    <label className="qf-label">
                      Target URL *
                      <input
                        type="url"
                        required
                        placeholder="https://facebook.com/..."
                        className="qf-input"
                        value={editSocialMissionForm.url}
                        onChange={(e) => setEditSocialMissionForm(f => ({ ...f, url: e.target.value }))}
                      />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <label className="qf-label">
                        Button Text *
                        <input
                          type="text"
                          required
                          placeholder="e.g. Follow FB →"
                          className="qf-input"
                          value={editSocialMissionForm.button_text}
                          onChange={(e) => setEditSocialMissionForm(f => ({ ...f, button_text: e.target.value }))}
                        />
                      </label>

                      <label className="qf-label">
                        Button Color (Hex) *
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <span style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: editSocialMissionForm.button_color || "#1877f2",
                            border: "2px solid rgba(255,255,255,0.2)",
                            flexShrink: 0
                          }} />
                          <input
                            type="text"
                            required
                            placeholder="#1877f2"
                            className="qf-input"
                            style={{ flex: 1 }}
                            value={editSocialMissionForm.button_color}
                            onChange={(e) => setEditSocialMissionForm(f => ({ ...f, button_color: e.target.value }))}
                          />
                        </div>
                      </label>
                    </div>

                    <label className="qf-label">
                      Sort Order
                      <input
                        type="number"
                        required
                        className="qf-input"
                        value={editSocialMissionForm.sort_order}
                        onChange={(e) => setEditSocialMissionForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      />
                    </label>

                    <div className="admin-modal__footer" style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button type="button" className="admin-cancel-btn" onClick={() => setEditingSocialMission(null)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="admin-save-btn"
                        style={{
                          background: "linear-gradient(135deg, #f5a623, #d97706)",
                          color: "#000",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: 8,
                          fontWeight: 800,
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        disabled={isUpdatingMission}
                      >
                        {isUpdatingMission ? "Saving..." : "Update Mission"}
                      </button>
                    </div>
                  </form>
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

                    return displayList.slice((boothPage - 1) * boothPageSize, (boothPage - 1) * boothPageSize + boothPageSize).map((b: any, idx: number) => (
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
              {(() => {
                const dbBooths = adminUsersList.filter(u => u.role === 'booth_staff');
                const totalBooths = dbBooths.length > 0 ? dbBooths.length : boothList.length;
                return (
                  <PaginationBar
                    currentPage={boothPage}
                    pageSize={boothPageSize}
                    totalItems={totalBooths}
                    onPageChange={setBoothPage}
                    onPageSizeChange={setBoothPageSize}
                  />
                );
              })()}
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

                {/* ⚡ Quick Preset Templates */}
                <div className="qf-section" style={{ background: "rgba(245, 166, 35, 0.03)", padding: "14px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span className="qf-section__label" style={{ margin: 0 }}>⚡ Quick Preset Templates</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Click to pre-fill</span>
                  </div>
                  <div className="qf-presets-bar" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                      {
                        icon: "📱",
                        name: "Social Follow",
                        data: {
                          title: "Follow @BlockQuest on X",
                          description: "1. Follow our official X account @BlockQuest\n2. Upload screenshot proof below to verify",
                          category: "social" as const,
                          xp: 100,
                          requires_proof: true,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "",
                          action_label: "Follow on X",
                          action_url: "https://x.com",
                        }
                      },
                      {
                        icon: "✈️",
                        name: "Join Telegram",
                        data: {
                          title: "Join Official Telegram Group",
                          description: "1. Join our BlockQuest PH Telegram community\n2. Say hi and upload a screenshot proof below!",
                          category: "social" as const,
                          xp: 100,
                          requires_proof: true,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "",
                          action_label: "Join Telegram",
                          action_url: "https://t.me",
                        }
                      },
                      {
                        icon: "💬",
                        name: "Event Feedback Note",
                        data: {
                          title: "Share Your Event Feedback",
                          description: "Write a short 1-sentence feedback about your experience at BlockQuest Fiesta PH today!",
                          category: "daily" as const,
                          xp: 150,
                          requires_proof: false,
                          requires_message: true,
                          is_quiz: false,
                          passcode: "",
                          action_label: "",
                          action_url: "",
                        }
                      },
                      {
                        icon: "🔑",
                        name: "Booth Passcode",
                        data: {
                          title: "Visit Sponsor Booth",
                          description: "Visit our sponsor booth in the main exhibition hall and ask the team for the secret passcode!",
                          category: "onboarding" as const,
                          xp: 150,
                          requires_proof: false,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "BOOTH-01",
                          action_label: "View Booth Info",
                          action_url: "",
                        }
                      },
                      {
                        icon: "📸+💬",
                        name: "Booth Photo + Review",
                        data: {
                          title: "Booth Photo & Feedback",
                          description: "1. Visit the sponsor booth and take a clear photo\n2. Type your feedback or favorite feature in the note box\n3. Submit both for admin review!",
                          category: "social" as const,
                          xp: 250,
                          requires_proof: true,
                          requires_message: true,
                          is_quiz: false,
                          passcode: "",
                          action_label: "View Floorplan",
                          action_url: "",
                        }
                      },
                      {
                        icon: "🤝+💬",
                        name: "Networking Buddy",
                        data: {
                          title: "Meet a Fellow Quester",
                          description: "1. Snap a selfie with someone you met at the event\n2. Write their name / handle in the note box\n3. Claim +200 XP for networking!",
                          category: "social" as const,
                          xp: 200,
                          requires_proof: true,
                          requires_message: true,
                          is_quiz: false,
                          passcode: "",
                          action_label: "",
                          action_url: "",
                        }
                      },
                      {
                        icon: "🎤+💬",
                        name: "Keynote Takeaway",
                        data: {
                          title: "Keynote Photo & Key Takeaway",
                          description: "1. Snap a photo of the main stage speaker\n2. Write your #1 key takeaway in the message box\n3. Claim +200 XP upon approval!",
                          category: "daily" as const,
                          xp: 200,
                          requires_proof: true,
                          requires_message: true,
                          is_quiz: false,
                          passcode: "",
                          action_label: "View Agenda",
                          action_url: "",
                        }
                      },
                      {
                        icon: "❓",
                        name: "Trivia Quiz",
                        data: {
                          title: "Web3 Fiesta Trivia",
                          description: "Answer the trivia question: What is the native token of Ethereum?",
                          category: "quiz" as const,
                          xp: 100,
                          requires_proof: false,
                          requires_message: false,
                          is_quiz: true,
                          quiz_answer: "ETH",
                          passcode: "",
                          action_label: "Start Quiz",
                          action_url: "",
                        }
                      },
                      {
                        icon: "📸",
                        name: "Stage Selfie",
                        data: {
                          title: "Take a Stage Photo / Selfie",
                          description: "Take a photo at the keynote stage during live sessions and upload proof!",
                          category: "daily" as const,
                          xp: 200,
                          requires_proof: true,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "",
                          action_label: "Stage Schedule",
                          action_url: "",
                        }
                      },
                      {
                        icon: "🎁",
                        name: "Swag Bag Claim",
                        data: {
                          title: "Claim Official Swag Bag",
                          description: "Head to the merch counter and enter the claim code given by staff to register your swag bag!",
                          category: "onboarding" as const,
                          xp: 300,
                          requires_proof: false,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "SWAG-2026",
                          action_label: "Merch Desk Map",
                          action_url: "",
                        }
                      },
                      {
                        icon: "💡",
                        name: "Workshop Code",
                        data: {
                          title: "Attend Developer Workshop",
                          description: "Attend the hands-on workshop session and enter the workshop code revealed on the final slide.",
                          category: "onboarding" as const,
                          xp: 350,
                          requires_proof: false,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "BUILD-WEB3",
                          action_label: "Workshop Slides",
                          action_url: "",
                        }
                      },
                      {
                        icon: "⚡",
                        name: "Instant Check-in",
                        data: {
                          title: "Daily Community Check-in",
                          description: "Claim your daily event participation bonus points with a single tap!",
                          category: "daily" as const,
                          xp: 50,
                          requires_proof: false,
                          requires_message: false,
                          is_quiz: false,
                          passcode: "",
                          action_label: "",
                          action_url: "",
                        }
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className="qf-preset-chip"
                        onClick={() => {
                          setQuestForm((prev) => {
                            const autoId = preset.data.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                            return {
                              ...prev,
                              ...preset.data,
                              id: editingQuest ? prev.id : autoId,
                            };
                          });
                        }}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ① Quest Title & Details */}
                <div className="qf-section">
                  <div className="qf-section__label">① Quest Details</div>

                  <label className="qf-label">
                    Quest Title *
                    <input
                      type="text"
                      value={questForm.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestForm((prev) => {
                          const autoId = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                          return {
                            ...prev,
                            title: val,
                            id: editingQuest ? prev.id : (autoId || prev.id),
                          };
                        });
                      }}
                      placeholder="e.g. Follow @BlockQuest on X"
                      required
                      className="qf-input"
                      style={{ fontSize: "1rem", fontWeight: 600 }}
                    />
                  </label>

                  <div className="admin-form-row" style={{ gridTemplateColumns: "1fr 100px", marginTop: 12 }}>
                    <label className="qf-label">
                      Quest ID (Slug) *
                      <input
                        type="text"
                        value={questForm.id}
                        onChange={(e) => setQuestForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                        placeholder="e.g. follow-x"
                        required
                        disabled={!!editingQuest}
                        className="qf-input"
                        style={{ fontFamily: "monospace" }}
                      />
                      <small>{editingQuest ? "Locked ID" : "Auto-generated from title · click to customize"}</small>
                    </label>

                    <label className="qf-label">
                      Sort Order
                      <input
                        type="number"
                        value={questForm.sort_order}
                        onChange={(e) => setQuestForm((f) => ({ ...f, sort_order: +e.target.value }))}
                        min={1}
                        className="qf-input"
                      />
                    </label>
                  </div>

                  <label className="qf-label" style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Instructions / Description</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          className="qf-pill"
                          style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                          onClick={() => setQuestForm((f) => ({
                            ...f,
                            description: (f.description ? f.description + "\n" : "") + "• Step 1:\n• Step 2:\n• Step 3:"
                          }))}
                        >
                          + Bullet List
                        </button>
                        <button
                          type="button"
                          className="qf-pill"
                          style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                          onClick={() => setQuestForm((f) => ({
                            ...f,
                            description: (f.description ? f.description + "\n" : "") + "1. Visit the page\n2. Complete action\n3. Upload screenshot proof"
                          }))}
                        >
                          + Numbered List
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={questForm.description ?? ""}
                      onChange={(e) => setQuestForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder={`Format example:\n1. Follow @BlockQuest on X\n2. Retweet pinned tweet\n3. Upload screenshot proof below`}
                      rows={4}
                      className="qf-input"
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        lineHeight: 1.5,
                        minHeight: 80,
                        resize: "vertical"
                      }}
                    />
                  </label>
                </div>

                {/* ② Reward, Category & Status */}
                <div className="qf-section">
                  <div className="qf-section__label">② Reward & Category</div>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 14, marginBottom: 12 }}>
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
                          style={{ paddingLeft: 34, fontWeight: 800, color: "#ffd166" }}
                        />
                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#f5a623", fontWeight: 800 }}>⚡</span>
                      </div>
                    </label>

                    <label className="qf-label">
                      Publish Status
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
                      {(["onboarding", "social", "daily", "quiz", "atfx"] as Quest["category"][]).map((c) => (
                        <button key={c} type="button"
                          onClick={() => setQuestForm((f) => ({ ...f, category: c }))}
                          className={`qf-pill${questForm.category === c ? " qf-pill--active" : ""}`}
                        >
                          {c === "onboarding" ? "🚀" : c === "social" ? "📣" : c === "daily" ? "📅" : c === "atfx" ? "📈" : "❓"} {c === "atfx" ? "ATFX" : c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                {/* ③ Action Button (Optional) */}
                <div className="qf-section">
                  <div className="qf-section__label">③ External Action Button <span style={{ fontWeight: 400, textTransform: "none", fontSize: "0.75rem", color: "#64748b" }}>(optional)</span></div>
                  <div className="admin-form-row">
                    <label className="qf-label">
                      Button Label
                      <input type="text" value={questForm.action_label ?? ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, action_label: e.target.value }))}
                        placeholder="e.g. Follow on X or Register now" className="qf-input" />
                    </label>
                    <label className="qf-label">
                      Button URL
                      <input type="text" value={questForm.action_url ?? ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, action_url: e.target.value }))}
                        placeholder="/register or https://x.com" className="qf-input" />
                    </label>
                  </div>
                </div>

                {/* ④ Verification Mode (Interactive 4-Way Selector) */}
                <div className="qf-section">
                  <div className="qf-section__label">④ Verification Mode</div>

                  <div className="qf-mode-grid" style={{ marginBottom: 14 }}>
                    {/* Instant Claim */}
                    <div
                      className={`qf-mode-card${!questForm.requires_proof && !questForm.requires_message && !questForm.is_quiz && !questForm.passcode ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, requires_proof: false, requires_message: false, is_quiz: false, passcode: "" }))}
                    >
                      <span className="qf-mode-card__icon">⚡</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Instant Claim</span>
                        <span className="qf-mode-card__desc">Players click claim to receive XP instantly.</span>
                      </div>
                    </div>

                    {/* Screenshot Proof */}
                    <div
                      className={`qf-mode-card${questForm.requires_proof && !questForm.requires_message ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, requires_proof: true, requires_message: false, is_quiz: false, passcode: "" }))}
                    >
                      <span className="qf-mode-card__icon">📷</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Screenshot Proof</span>
                        <span className="qf-mode-card__desc">Upload photo proof for admin verification.</span>
                      </div>
                    </div>

                    {/* Messagebox Note */}
                    <div
                      className={`qf-mode-card${questForm.requires_message && !questForm.requires_proof ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, requires_message: true, requires_proof: false, is_quiz: false, passcode: "" }))}
                    >
                      <span className="qf-mode-card__icon">💬</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Messagebox Note</span>
                        <span className="qf-mode-card__desc">Quester submits a text message for admin review.</span>
                      </div>
                    </div>

                    {/* Photo + Message */}
                    <div
                      className={`qf-mode-card${questForm.requires_proof && questForm.requires_message ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, requires_proof: true, requires_message: true, is_quiz: false, passcode: "" }))}
                    >
                      <span className="qf-mode-card__icon">📸+💬</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Photo + Message</span>
                        <span className="qf-mode-card__desc">Upload photo AND add text message.</span>
                      </div>
                    </div>

                    {/* Quiz Answer */}
                    <div
                      className={`qf-mode-card${questForm.is_quiz ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, is_quiz: true, requires_proof: false, requires_message: false, passcode: "", category: "quiz" }))}
                    >
                      <span className="qf-mode-card__icon">❓</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Quiz Question</span>
                        <span className="qf-mode-card__desc">Type exact answer string to claim XP.</span>
                      </div>
                    </div>

                    {/* Passcode / PIN */}
                    <div
                      className={`qf-mode-card${!questForm.requires_proof && !questForm.requires_message && !questForm.is_quiz && !!questForm.passcode ? " qf-mode-card--active" : ""}`}
                      onClick={() => setQuestForm((f) => ({ ...f, requires_proof: false, requires_message: false, is_quiz: false, passcode: f.passcode || "CODE" }))}
                    >
                      <span className="qf-mode-card__icon">🔑</span>
                      <div className="qf-mode-card__info">
                        <span className="qf-mode-card__title">Secret Passcode</span>
                        <span className="qf-mode-card__desc">Enter PIN from speaker or booth.</span>
                      </div>
                    </div>
                  </div>

                  {/* Mode-Specific Input Fields */}
                  {questForm.is_quiz && (
                    <div style={{ background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 12, padding: 14 }}>
                      <label className="qf-label">
                        ❓ Correct Quiz Answer *
                        <input
                          type="text"
                          placeholder={editingQuest ? "Enter new answer (or leave blank to keep current)" : "e.g. satoshi"}
                          value={questForm.quiz_answer ?? ""}
                          onChange={(e) => setQuestForm((f) => ({ ...f, quiz_answer: e.target.value }))}
                          className="qf-input"
                          style={{ marginTop: 6 }}
                        />
                        <small>Case-insensitive · Hidden from players until they answer correctly</small>
                      </label>
                    </div>
                  )}

                  {questForm.passcode !== undefined && questForm.passcode !== "" && !questForm.is_quiz && !questForm.requires_proof && (
                    <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 12, padding: 14 }}>
                      <label className="qf-label">
                        🔑 Secret Passcode *
                        <input
                          type="text"
                          placeholder="e.g. BOOTH-07 or FIESTA2026"
                          value={questForm.passcode ?? ""}
                          onChange={(e) => setQuestForm((f) => ({ ...f, passcode: e.target.value.toUpperCase() }))}
                          className="qf-input"
                          style={{ marginTop: 6, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.08em" }}
                        />
                        <small>Share this secret code with attendees visiting your booth or stage</small>
                      </label>
                    </div>
                  )}
                </div>

                {/* ⑤ Advanced Rules (Expiration & Prerequisite) */}
                <div className="qf-section">
                  <div className="qf-section__label">⑤ Optional Rules & Locking</div>

                  <div className="admin-form-row" style={{ marginBottom: 12 }}>
                    <label className="qf-label">
                      ⏱️ Expiration Time <span style={{ fontWeight: 400, color: "#64748b" }}>(Flash Quest)</span>
                      <input
                        type="datetime-local"
                        value={questForm.expires_at ? new Date(questForm.expires_at).toISOString().slice(0, 16) : ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, expires_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                        className="qf-input"
                      />
                    </label>

                    <label className="qf-label">
                      🔒 Prerequisite Quest <span style={{ fontWeight: 400, color: "#64748b" }}>(Quest Chain)</span>
                      <select
                        value={questForm.depends_on_quest_id ?? ""}
                        onChange={(e) => setQuestForm((f) => ({ ...f, depends_on_quest_id: e.target.value }))}
                        className="qf-input"
                        style={{ cursor: "pointer" }}
                      >
                        <option value="">None (Unlocked immediately)</option>
                        {quests
                          .filter((q) => q.id !== questForm.id)
                          .map((q) => (
                            <option key={q.id} value={q.id}>
                              Requires: {q.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
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
                <div className="quest-preview-panel__label">👁 Live Mobile Preview</div>
                <div className="quest-preview-card">
                  <div className="quest-preview-card__top">
                    <div className="quest-preview-card__badges">
                      <span className={`quest-preview-badge quest-preview-badge--${questForm.category || "onboarding"}`}>
                        {questForm.category === "social" ? "📣" : questForm.category === "daily" ? "📅" : questForm.category === "quiz" ? "❓" : questForm.category === "atfx" ? "📈" : "🚀"}
                        {" "}{(questForm.category || "onboarding").charAt(0).toUpperCase() + (questForm.category || "onboarding").slice(1)}
                      </span>
                      {questForm.requires_proof && (
                        <span className="quest-preview-badge quest-preview-badge--proof">📷 Proof</span>
                      )}
                      {questForm.is_quiz && (
                        <span className="quest-preview-badge" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)" }}>❓ Quiz</span>
                      )}
                      {questForm.passcode && (
                        <span className="quest-preview-badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)" }}>🔑 Passcode</span>
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

                  {questForm.expires_at && (
                    <div style={{ fontSize: "0.72rem", color: "#f87171", margin: "6px 0", fontWeight: 700 }}>
                      ⏱️ Flash Quest: Ends {new Date(questForm.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {questForm.depends_on_quest_id && (
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "6px 0" }}>
                      🔒 Locked until prerequisite is completed
                    </div>
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
                        {questForm.requires_proof ? "📷 Upload Proof" : questForm.is_quiz ? "❓ Answer Quiz" : questForm.passcode ? "🔑 Enter Code" : "⚡ Claim XP"}
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
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='250' viewBox='0 0 200 200'><rect width='100%' height='100%' fill='%231e1e2e'/><text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' font-size='48'>🖼️</text><text x='50%' y='70%' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-size='12' font-family='sans-serif' font-weight='bold'>Image Load Error / Broken Link</text></svg>";
                }}
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

      {/* ── Quest Verification Action & Review Modal ── */}
      {actionModalVerification && (
        <div
          className="admin-modal-overlay"
          onClick={() => {
            if (!isProcessingAction) {
              setActionModalVerification(null);
              setVerificationActionReason("");
            }
          }}
          style={{ zIndex: 1000, background: "rgba(0,0,0,0.85)" }}
        >
          <div
            className="admin-modal"
            style={{ maxWidth: 580, width: "94%", padding: "24px 28px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--gold-light)", display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <span>⚡</span> Quest Verification Action
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Review submitted proof and take administrative action
                </p>
              </div>
              <button
                className="admin-modal__close"
                onClick={() => {
                  if (!isProcessingAction) {
                    setActionModalVerification(null);
                    setVerificationActionReason("");
                  }
                }}
              >
                ✕
              </button>
            </div>

            {/* Quester & Quest Info Card */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(245,166,35,0.2)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Quester / Attendee:</span>
                  <strong style={{ fontSize: "0.95rem", color: "#fff" }}>{actionModalVerification.user_name}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: 8 }}>({actionModalVerification.user_email})</span>
                </div>
                {actionModalVerification.ticket_code && (
                  <span style={{
                    padding: "3px 8px",
                    background: "rgba(245,166,35,0.15)",
                    border: "1px solid rgba(245,166,35,0.3)",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    color: "var(--gold-light)",
                    fontWeight: 700
                  }}>
                    🎫 {actionModalVerification.ticket_code}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Quest Title:</span>
                  <span style={{ fontSize: "0.9rem", color: "#c084fc", fontWeight: 700 }}>{actionModalVerification.quest_title}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="admin-xp-badge" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                    ⭐ +{actionModalVerification.xp} XP
                  </span>
                  <span className={`admin-status-badge ${actionModalVerification.status === "Approved" ? "admin-status-badge--live" : actionModalVerification.status === "Rejected" ? "admin-status-badge--done" : "admin-status-badge--soon"}`}>
                    {actionModalVerification.status === "Approved" ? "✓ Approved" : actionModalVerification.status === "Rejected" ? "✕ Rejected" : "⏳ Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Submitted Proof Section */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📸 Submitted Proof
              </span>

              {actionModalVerification.proof_url && actionModalVerification.proof_url !== "Text Submission" ? (
                <div style={{
                  position: "relative",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid rgba(245, 166, 35, 0.4)",
                  background: "#050508",
                  textAlign: "center",
                  padding: 10
                }}>
                  <img
                    src={actionModalVerification.proof_url}
                    alt="Proof full"
                    style={{
                      maxHeight: 220,
                      maxWidth: "100%",
                      objectFit: "contain",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                    onClick={() => setSelectedProofImage(actionModalVerification.proof_url)}
                    title="Click to view high-res zoom preview"
                  />
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedProofImage(actionModalVerification.proof_url)}
                      style={{
                        background: "rgba(245, 166, 35, 0.15)",
                        border: "1px solid rgba(245, 166, 35, 0.3)",
                        color: "var(--gold-light)",
                        padding: "4px 12px",
                        borderRadius: 8,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      🔍 Click to Zoom / Inspect Image
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  💬 No screenshot required for this verification (Text / Instant submission).
                </div>
              )}

              {actionModalVerification.user_message && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: "rgba(245, 166, 35, 0.08)",
                  border: "1px solid rgba(245, 166, 35, 0.25)",
                  borderRadius: 8
                }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--gold-light)", fontWeight: 700, display: "block", marginBottom: 4 }}>
                    💬 Quester Note / Message:
                  </span>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#fff", whiteSpace: "pre-wrap" }}>
                    "{actionModalVerification.user_message}"
                  </p>
                </div>
              )}

              {actionModalVerification.rejection_reason && (
                <div style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                  color: "#f87171"
                }}>
                  <strong>Previous Rejection Reason:</strong> "{actionModalVerification.rejection_reason}"
                </div>
              )}
            </div>

            {/* Action Buttons Section */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ⚡ Administrative Action
              </span>

              {/* Approve Button */}
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => handleVerifyQuest(actionModalVerification.id, "Approved")}
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "1px solid #10b981",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  cursor: isProcessingAction ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                  marginBottom: 16
                }}
              >
                {isProcessingAction ? "Processing..." : `🎉 Approve & Award +${actionModalVerification.xp} XP`}
              </button>

              {/* Reject Section with presets */}
              <div style={{
                background: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16
              }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f87171", display: "block", marginBottom: 8 }}>
                  ✕ Or Reject with Reason:
                </span>

                {/* Quick Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {[
                    "📷 Unclear / Blurry Image",
                    "🚫 Incorrect Quest Mission",
                    "📑 Duplicate Proof",
                    "❓ Ineligible Screenshot"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVerificationActionReason(preset)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#e2e8f0",
                        fontSize: "0.72rem",
                        cursor: "pointer"
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  className="qf-input"
                  rows={2}
                  placeholder="Type rejection reason (optional)..."
                  value={verificationActionReason}
                  onChange={(e) => setVerificationActionReason(e.target.value)}
                  style={{ width: "100%", fontSize: "0.82rem", resize: "vertical", marginBottom: 10 }}
                />

                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleVerifyQuest(actionModalVerification.id, "Rejected", verificationActionReason.trim())}
                  style={{
                    width: "100%",
                    padding: "9px 16px",
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    borderRadius: 8,
                    color: "#ef4444",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: isProcessingAction ? "not-allowed" : "pointer"
                  }}
                >
                  {isProcessingAction ? "Processing..." : "✕ Confirm Reject Submission"}
                </button>
              </div>

              {/* Reset to Pending (if already verified) */}
              {actionModalVerification.status !== "Pending" && (
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleVerifyQuest(actionModalVerification.id, "Pending")}
                  style={{
                    width: "100%",
                    padding: "8px 14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "var(--text-secondary)",
                    fontSize: "0.8rem",
                    cursor: isProcessingAction ? "not-allowed" : "pointer",
                    marginBottom: 12
                  }}
                >
                  🔄 Reset Status Back to Pending
                </button>
              )}

              {/* Cancel Button */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-cancel-btn"
                  onClick={() => {
                    setActionModalVerification(null);
                    setVerificationActionReason("");
                  }}
                  style={{ width: "100%", padding: "10px", textAlign: "center" }}
                >
                  Close Modal
                </button>
              </div>
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
              <br /><br />
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
