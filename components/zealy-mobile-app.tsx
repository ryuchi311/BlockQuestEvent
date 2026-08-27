"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ZealyIntroAnimation from "./zealy-intro-animation";
import InstallPrompt from "./install-prompt";

interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  status: "Live" | "Soon" | "Done" | "Pending Verification" | "Approved" | "Rejected";
  category: "onboarding" | "social" | "daily" | "quiz" | "atfx";
  actionLabel?: string;
  actionUrl?: string;
  requiresProof?: boolean;
  requiresMessage?: boolean;
  is_quiz?: boolean;
  quiz_options?: string[];
  correct_option_index?: number;
  passcode?: string;
  has_passcode?: boolean;
  publish_at?: string;
  expires_at?: string;
  depends_on_quest_id?: string;
}

const initialQuests: Quest[] = [
  {
    id: "register",
    title: "Register for BlockQuest Fiesta PH",
    description: "Secure your official ticket pass on our registration page to unlock the quest line.",
    xp: 250,
    status: "Live",
    category: "onboarding",
    actionLabel: "Register now",
    actionUrl: "/register"
  },
  {
    id: "checkin",
    title: "Complete physical check-in",
    description: "Scan your QR pass at the entrance gate on Saturday, Oct 10 to claim this XP reward.",
    xp: 500,
    status: "Soon",
    category: "onboarding"
  },
  {
    id: "promo-bonus",
    title: "Promo Code Bonus",
    description: "Claim your bonus XP for registering with an official promo code or referral link.",
    xp: 250,
    status: "Live",
    category: "onboarding"
  },
  {
    id: "follow-x",
    title: "Follow @BlockQuest on X",
    description: "Follow our official X handle and submit a screenshot proof to verify completion.",
    xp: 100,
    status: "Live",
    category: "social",
    actionLabel: "Follow on X",
    actionUrl: "https://x.com",
    requiresProof: true
  },
  {
    id: "join-tg",
    title: "Join BlockQuest PH Telegram",
    description: "Connect in our official telegram group and upload a screenshot proof for admin verification.",
    xp: 100,
    status: "Live",
    category: "social",
    actionLabel: "Join group",
    actionUrl: "https://t.me",
    requiresProof: true
  },
  {
    id: "discord-member",
    title: "Join BlockQuest Discord Server",
    description: "Become a member of our official Discord community and automatically verify your membership to claim XP.",
    xp: 150,
    status: "Live",
    category: "social",
    actionLabel: "Join & Verify Discord",
    actionUrl: "https://discord.gg"
  },
  {
    id: "daily-claim",

    title: "Daily Check-in",
    description: "Claim your daily check-in points to boost your leaderboard ranking.",
    xp: 50,
    status: "Live",
    category: "daily"
  }
];

const initialLeaderboard: { rank: number; name: string; points: number; change: string; accent?: string }[] = [];

function QuestCardDescription({ description }: { description: string }) {
  if (!description) return null;

  return (
    <p
      className="quest-card__desc"
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: "1.4",
        margin: "4px 0 8px",
      }}
    >
      {description}
    </p>
  );
}

export default function ZealyMobileApp() {
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = useState<"quests" | "leaderboard" | "info" | "profile">("quests");
  const [quests, setQuests] = useState<Quest[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_quests");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge in any new quests from initialQuests that aren't in local storage
        const existingIds = new Set(parsed.map((q: Quest) => q.id));
        const missingQuests = initialQuests.filter((q) => !existingIds.has(q.id));
        return [...parsed, ...missingQuests];
      }
    }
    return initialQuests;
  });
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [userXp, setUserXp] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_xp");
      if (saved) return Number(saved);
    }
    return 0;
  });
  const [userRank, setUserRank] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_rank");
      if (saved) return Number(saved);
    }
    return 12;
  });
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [userMessageInput, setUserMessageInput] = useState("");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [passcodeAnswer, setPasscodeAnswer] = useState("");
  const [visitedActions, setVisitedActions] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_visited");
      if (saved) return JSON.parse(saved);
    }
    return {};
  });
  const [userVerifications, setUserVerifications] = useState<any[]>([]);
  const [completedQuestRecords, setCompletedQuestRecords] = useState<any[]>([]);
  const [showCompletedQuests, setShowCompletedQuests] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "error" | "warning" | "success" | "info";
    icon?: string;
  } | null>(null);
  const [showQrZoomModal, setShowQrZoomModal] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const showNotice = React.useCallback((
    message: string,
    type: "error" | "warning" | "success" | "info" = "error",
    title?: string,
    icon?: string
  ) => {
    let defaultTitle = "Notice";
    let defaultIcon = "ℹ️";
    if (type === "error") {
      defaultTitle = "Quest Claim Restricted";
      defaultIcon = "🔒";
    } else if (type === "warning") {
      defaultTitle = "Action Required";
      defaultIcon = "⚠️";
    } else if (type === "success") {
      defaultTitle = "Success!";
      defaultIcon = "🎉";
    }
    setNoticeModal({
      isOpen: true,
      title: title || defaultTitle,
      message,
      type,
      icon: icon || defaultIcon,
    });
  }, []);

  // Load ticket if user was registered/logged in in this session
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketCountryCode, setTicketCountryCode] = useState("+63");
  const [ticketMobileNum, setTicketMobileNum] = useState("");
  const [ticketPassword, setTicketPassword] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_user");
      if (saved) return JSON.parse(saved);
    }
    return null;
  });
  const [qrPass, setQrPass] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_qr");
      if (saved) return JSON.parse(saved);
    }
    return null;
  });
  const [ticketError, setTicketError] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketPinCode, setTicketPinCode] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);

  // Security PIN modal states
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinModalError, setPinModalError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [claimedQuestIds, setClaimedQuestIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bq_claimed");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [isGateCheckedIn, setIsGateCheckedIn] = useState<boolean>(false);

  // Inactivity tracking state
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(30);
  const inactivityTimerRef = React.useRef<any>(null);
  const warningCountdownRef = React.useRef<any>(null);

  // Handle logout and clear persistent states
  function handleLogout() {
    setAuthenticatedUser(null);
    setQrPass(null);
    setIsGateCheckedIn(false);
    setTicketEmail("");
    setTicketMobileNum("");
    setTicketCountryCode("+63");
    setTicketError("");
    setTicketPinCode("");
    setShowPinInput(false);
    setUserXp(0);
    setUserRank(12);
    setQuests(initialQuests);
    setActiveTab("quests");

    if (typeof window !== "undefined") {
      localStorage.removeItem("bq_user");
      localStorage.removeItem("bq_qr");
      localStorage.removeItem("bq_xp");
      localStorage.removeItem("bq_rank");
      localStorage.removeItem("bq_quests");
      localStorage.removeItem("bq_visited");
      localStorage.removeItem("bq_claimed");
    }
    setClaimedQuestIds([]);
    setCompletedQuestRecords([]);
  }

  const resetInactivityTimer = React.useCallback(() => {
    setInactivityWarning(false);
    setInactivityCountdown(30);

    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningCountdownRef.current) clearInterval(warningCountdownRef.current);

    // If authenticated user exists, set inactivity timer to 4.5 minutes (270 seconds)
    // After 4.5 minutes, show warning popup/countdown for 30 seconds (total 5 minutes)
    if (authenticatedUser) {
      inactivityTimerRef.current = setTimeout(() => {
        setInactivityWarning(true);
      }, 270000);
    }
  }, [authenticatedUser]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function safeJson<T = any>(res: Response): Promise<T> {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      if (!res.ok) {
        throw new Error(`Server error HTTP ${res.status}`);
      }
      throw new Error(`Invalid response format from server`);
    }
  }

  // Save states to localStorage when they change
  React.useEffect(() => {
    if (!mounted) return;
    if (authenticatedUser) {
      localStorage.setItem("bq_user", JSON.stringify(authenticatedUser));
    } else {
      localStorage.removeItem("bq_user");
    }
  }, [authenticatedUser, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    if (qrPass) {
      localStorage.setItem("bq_qr", JSON.stringify(qrPass));
    } else {
      localStorage.removeItem("bq_qr");
    }
  }, [qrPass, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bq_xp", userXp.toString());
  }, [userXp, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bq_rank", userRank.toString());
  }, [userRank, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bq_quests", JSON.stringify(quests));
  }, [quests, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bq_visited", JSON.stringify(visitedActions));
  }, [visitedActions, mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bq_claimed", JSON.stringify(claimedQuestIds));
  }, [claimedQuestIds, mounted]);

  // Event listeners for user activity tracking
  React.useEffect(() => {
    if (!mounted || !authenticatedUser) return;

    resetInactivityTimer();

    const activityEvents = ["mousedown", "keydown", "touchstart", "mousemove", "scroll"];
    const handleActivity = () => resetInactivityTimer();

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningCountdownRef.current) clearInterval(warningCountdownRef.current);
    };
  }, [mounted, authenticatedUser, resetInactivityTimer]);


  // Countdown effect when warning is shown
  React.useEffect(() => {
    if (inactivityWarning) {
      warningCountdownRef.current = setInterval(() => {
        setInactivityCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(warningCountdownRef.current);
            handleLogout();
            setInactivityWarning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (warningCountdownRef.current) clearInterval(warningCountdownRef.current);
    };
  }, [inactivityWarning]);

  const handleTicketMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, ""); // digits only
    if (value.startsWith("0")) {
      value = value.substring(1); // strip leading zero
    }
    setTicketMobileNum(value);
  };

  const userLevel = Math.floor(userXp / 300) + 1;
  const xpInCurrentLevel = userXp % 300;
  const xpProgressPercentage = Math.min(100, Math.floor((xpInCurrentLevel / 300) * 100));

  const [newQuestAlert, setNewQuestAlert] = useState<{ count: number; questTitle: string } | null>(null);
  const previousQuestsCountRef = React.useRef<number | null>(null);

  // Dynamically sync quests from API
  const loadApiQuests = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quests");
      const json = await safeJson(res);
      if (res.ok && Array.isArray(json.quests)) {
        const mappedQuests: Quest[] = json.quests
          .filter((q: any) => String(q.status || "").toLowerCase() !== "draft")
          .map((q: any) => ({
            id: q.id,
            title: q.title,
            description: q.description || "",
            xp: q.xp || 100,
            status: q.status || "Soon",
            category: q.category || "onboarding",
            actionLabel: q.action_label || undefined,
            actionUrl: q.action_url || undefined,
            requiresProof: !!q.requires_proof,
            requiresMessage: !!q.requires_message,
            passcode: q.passcode || undefined,
            publish_at: q.publish_at || undefined,
            expires_at: q.expires_at || undefined,
            sort_order: q.sort_order ?? 999,
            created_at: q.created_at || undefined,
          }))
          .map((q: any) => {
            // Auto-publish logic: if publish_at is set, check if timestamp is reached
            let evalStatus = q.status;
            if (q.publish_at) {
              const publishTime = new Date(q.publish_at).getTime();
              if (publishTime > Date.now()) {
                evalStatus = "Soon";
              } else if (q.status === "Soon") {
                evalStatus = "Live";
              }
            }
            return { ...q, status: evalStatus };
          });

        // Detect if new quests were published by admin
        if (previousQuestsCountRef.current !== null && mappedQuests.length > previousQuestsCountRef.current) {
          const diff = mappedQuests.length - previousQuestsCountRef.current;
          const latestQuest = mappedQuests[mappedQuests.length - 1];
          setNewQuestAlert({ count: diff, questTitle: latestQuest.title });
        }
        previousQuestsCountRef.current = mappedQuests.length;

        // Preserve local quest verification status (Done, Pending Verification, Approved, Rejected) to prevent status flickering
        setQuests((prevQuests) => {
          return mappedQuests.map((newQ) => {
            if (newQ.id === "checkin") {
              const existing = prevQuests.find((p) => p.id === "checkin");
              if (existing?.status === "Done") return { ...newQ, status: "Done" };
              return { ...newQ, status: isGateCheckedIn ? "Live" : "Soon" };
            }
            const existing = prevQuests.find((p) => p.id === newQ.id);
            if (
              existing &&
              (existing.status === "Done" ||
                existing.status === "Pending Verification" ||
                existing.status === "Approved" ||
                existing.status === "Rejected")
            ) {
              return { ...newQ, status: existing.status };
            }
            return newQ;
          });
        });
      }
    } catch {
      // Fallback to initialQuests
    }
  }, [isGateCheckedIn]);

  const fetchUserVerifications = React.useCallback(async () => {
    const email = ticketEmail || authenticatedUser?.email || qrPass?.email || "quester@blockquest.ph";
    try {
      const [verifRes, msgRes] = await Promise.all([
        fetch(`/api/admin/verifications?email=${encodeURIComponent(email)}`),
        fetch(`/api/admin/messages?email=${encodeURIComponent(email)}`)
      ]);
      const verifJson = await safeJson(verifRes);
      const msgJson = await safeJson(msgRes);

      const vList = verifRes.ok && Array.isArray(verifJson.verifications)
        ? verifJson.verifications.map((v: any) => ({ ...v, uniqueKey: `verif_${v.id || v.quest_id}` }))
        : [];
      const mList = msgRes.ok && Array.isArray(msgJson.messages)
        ? msgJson.messages.map((m: any) => ({ ...m, uniqueKey: `msg_${m.id || m.quest_id}` }))
        : [];

      const combined = [...vList, ...mList].sort(
        (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setUserVerifications(combined);
    } catch {
      // ignore
    }
  }, [ticketEmail, authenticatedUser, qrPass]);

  const fetchLeaderboard = React.useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      const json = await safeJson(res);
      if (res.ok && Array.isArray(json.leaderboard)) {
        setLeaderboard(json.leaderboard);
        const myEmail = ticketEmail || authenticatedUser?.email || qrPass?.email;
        if (myEmail) {
          const myEntry = json.leaderboard.find((u: any) => u.email === myEmail);
          if (myEntry) setUserRank(myEntry.rank);
        }
      }
    } catch {
      // ignore
    }
  }, [ticketEmail, authenticatedUser, qrPass]);

  const syncUserData = React.useCallback(async () => {
    const email = ticketEmail || authenticatedUser?.email || qrPass?.email || "quester@blockquest.ph";
    if (!email) return;

    try {
      const res = await fetch(`/api/user/sync?email=${encodeURIComponent(email)}`);
      const json = await safeJson(res);
      if (!res.ok) return;

      const { totalXp, completedQuests, completedQuestDetails, verifications, isCheckedIn, promoCode } = json;

      if (typeof isCheckedIn === "boolean") {
        setIsGateCheckedIn(isCheckedIn);
      }

      if (typeof totalXp === "number") {
        setUserXp(totalXp);
      }

      if (Array.isArray(completedQuestDetails)) {
        setCompletedQuestRecords(completedQuestDetails);
      }

      const compMap = new Map<string, string>();
      (completedQuestDetails || []).forEach((c: any) => {
        if (c.quest_id) compMap.set(c.quest_id, c.completed_at || "");
      });
      (completedQuests || []).forEach((id: string) => {
        if (!compMap.has(id)) compMap.set(id, "");
      });

      const verifMap = new Map<string, { status: string; createdAt: string }>();
      (verifications || []).forEach((v: any) => {
        const existing = verifMap.get(v.quest_id);
        if (!existing || v.status === "Approved" || (existing.status !== "Approved" && v.status === "Pending")) {
          verifMap.set(v.quest_id, { status: v.status, createdAt: v.created_at || "" });
        }
      });

      setQuests((prevQuests) =>
        prevQuests.map((q) => {
          if (q.id === "promo-bonus") {
            const isDone = compMap.has(q.id);
            return {
              ...q,
              title: promoCode ? `Promo Code Bonus (${promoCode})` : "Promo Code Bonus",
              description: promoCode
                ? `Claim your bonus 250 XP for registering with promo code: ${promoCode}`
                : "Claim your bonus XP for registering with an official promo code or referral link.",
              status: isDone ? "Done" : (promoCode ? "Live" : q.status),
              completedAt: compMap.get(q.id) || (q as any).completedAt,
            };
          }
          if (compMap.has(q.id)) {
            return { ...q, status: "Done", completedAt: compMap.get(q.id) || (q as any).completedAt };
          }
          if (q.id === "checkin") {
            return { ...q, status: isCheckedIn ? "Live" : "Soon" };
          }
          const vData = verifMap.get(q.id);
          if (vData?.status === "Pending") {
            return { ...q, status: "Pending Verification" };
          }
          if (vData?.status === "Approved") {
            return { ...q, status: "Done", completedAt: vData.createdAt || (q as any).completedAt };
          }
          if (vData?.status === "Rejected") {
            return { ...q, status: "Rejected" };
          }
          return q;
        })
      );
    } catch {
      // ignore
    }
  }, [ticketEmail, authenticatedUser, qrPass]);

  // Handle Discord OAuth Callback URL parameters
  React.useEffect(() => {
    if (!mounted) return;
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const error = urlParams.get("error");
    const xpAwarded = urlParams.get("xp");

    if (status === "discord_claimed") {
      showNotice(
        `Your Discord membership has been verified! You earned +${xpAwarded || 150} XP.`,
        "success",
        "Discord Quest Completed!",
        "🎉"
      );
      syncUserData();
      // Clean query parameters from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === "already_claimed") {
      showNotice("You have already claimed your Discord membership XP!", "info", "Already Claimed", "ℹ️");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error === "not_a_discord_member") {
      showNotice(
        "We could not verify your membership. Please join the Discord server first, then try verifying again!",
        "error",
        "Discord Membership Not Found",
        "🔒"
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error === "discord_auth_failed" || error === "discord_token_error") {
      showNotice("Discord authorization failed or was cancelled. Please try again.", "error", "Authorization Failed", "✕");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [mounted, showNotice, syncUserData]);

  useEffect(() => {
    fetchUserVerifications();
    fetchLeaderboard();
    syncUserData();
  }, [fetchUserVerifications, fetchLeaderboard, syncUserData, activeTab]);

  // Poll for new quests, verifications & user state sync every 3 seconds for fast live updates
  useEffect(() => {
    loadApiQuests();
    fetchUserVerifications();
    fetchLeaderboard();
    syncUserData();
    const interval = setInterval(() => {
      loadApiQuests();
      fetchUserVerifications();
      fetchLeaderboard();
      syncUserData();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadApiQuests, fetchUserVerifications, fetchLeaderboard, syncUserData]);

  const handleQuestClick = (quest: Quest) => {
    // Check prerequisite lock
    if (quest.depends_on_quest_id) {
      const parentCompleted = quests.some((p) => p.id === quest.depends_on_quest_id && p.status === "Done");
      if (!parentCompleted) {
        const parentQuest = quests.find((p) => p.id === quest.depends_on_quest_id);
        showNotice(`You must complete "${parentQuest?.title || quest.depends_on_quest_id}" first before unlocking this quest.`, "warning", "Quest Locked", "🔒");
        return;
      }
    }

    // Check expiration
    if (quest.expires_at && new Date(quest.expires_at).getTime() < Date.now()) {
      showNotice("This quest has expired and can no longer be claimed.", "warning", "Quest Expired", "⏱️");
      return;
    }

    if (quest.status === "Soon" && quest.id !== "checkin") return;

    setSelectedQuest(quest);
  };

  const handleProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG 75% quality for lightweight payloads under high concurrency
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setProofImage(compressedDataUrl);
        } else {
          setProofImage(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Supabase syncUserData handles total XP and quest status sync seamlessly

  function isStrictSocialLink(url: string): { valid: boolean; platform: "facebook" | "instagram" | null } {
    if (!url || typeof url !== "string") return { valid: false, platform: null };
    const trimmed = url.trim();
    if (!trimmed) return { valid: false, platform: null };
    try {
      const parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
      const host = parsed.hostname.toLowerCase();
      const isFb = host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host === "fb.watch";
      const isIg = host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
      if (isFb) return { valid: true, platform: "facebook" };
      if (isIg) return { valid: true, platform: "instagram" };
      return { valid: false, platform: null };
    } catch {
      return { valid: false, platform: null };
    }
  }

  function isSocialLinkQuest(q?: Quest | null): boolean {
    if (!q) return false;
    const text = `${q.title} ${q.description || ""} ${q.actionLabel || ""} ${q.actionUrl || ""}`.toLowerCase();
    return Boolean(
      q.requiresMessage &&
      !q.requiresProof &&
      (
        q.category === "social" ||
        text.includes("facebook") ||
        text.includes("instagram") ||
        text.includes("feed") ||
        text.includes("selfie") ||
        text.includes("post link") ||
        text.includes("fb/ig") ||
        text.includes("hashtag")
      )
    );
  }

  const handleSubmitProof = async () => {
    if (!selectedQuest || selectedQuest.status === "Done" || selectedQuest.status === "Pending Verification") return;

    // Validate submission requirements
    const hasProof = !!proofImage;
    const hasMessage = !!userMessageInput.trim();

    if (selectedQuest.requiresProof && !hasProof) return;
    if (selectedQuest.requiresMessage && !hasMessage) {
      if (isSocialLinkQuest(selectedQuest)) {
        showNotice("Please paste your public Facebook or Instagram post link before submitting!", "warning", "Link Required", "🔗");
      } else {
        showNotice("Please enter a message / note before submitting!", "warning", "Message Required", "💬");
      }
      return;
    }

    if (isSocialLinkQuest(selectedQuest)) {
      const check = isStrictSocialLink(userMessageInput);
      if (!check.valid) {
        showNotice("Strictly only public Facebook or Instagram post links are allowed!\n\nExamples:\n• https://www.facebook.com/...\n• https://www.instagram.com/p/...", "error", "Invalid Social Link", "⚠️");
        return;
      }
    } else if (userMessageInput.trim().length > 250) {
      showNotice("Message note cannot exceed 250 characters!", "warning", "Note Too Long", "💬");
      return;
    }

    if (!hasProof && !hasMessage) return;

    setProofSubmitting(true);
    try {
      const endpoint = selectedQuest.requiresProof ? "/api/admin/verifications" : "/api/admin/messages";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quest_id: selectedQuest.id,
          quest_title: selectedQuest.title,
          user_name: authenticatedUser?.fullName || qrPass?.fullName || "Registered Quester",
          user_email: ticketEmail || authenticatedUser?.email || "quester@blockquest.ph",
          ticket_code: qrPass?.passCode || "BQF-GUEST",
          xp: selectedQuest.xp,
          proof_url: proofImage || "Social Post Link",
          user_message: userMessageInput.trim() || null,
        }),
      });
      const json = await safeJson(res);
      if (!res.ok) {
        showNotice(json.error || "Could not save to database.", "error", "Submission Failed", "❌");
        return;
      }
      setQuests((prev) =>
        prev.map((q) => (q.id === selectedQuest.id ? { ...q, status: "Pending Verification" } : q))
      );
      setSelectedQuest(null);
      setProofImage(null);
      setUserMessageInput("");
      fetchUserVerifications();
    } catch {
      showNotice("Submission error. Please try again.", "error", "Submission Error", "❌");
    } finally {
      setProofSubmitting(false);
    }
  };

  const handleClaimXp = async () => {
    if (!selectedQuest || selectedQuest.status === "Done" || selectedQuest.status === "Pending Verification") return;

    if (selectedQuest.requiresProof || selectedQuest.requiresMessage) {
      showNotice("This quest requires admin review before XP is awarded. Please submit your proof / message note for verification!", "info", "Admin Review Required", "⏳");
      return;
    }

    if (selectedQuest.has_passcode || selectedQuest.passcode) {
      if (!passcodeAnswer.trim()) {
        showNotice("Passcode is required! Please ask the booth staff or stage presenter for the secret code.", "warning", "Passcode Required", "🔑");
        return;
      }
    }

    setClaiming(true);
    try {
      const email = ticketEmail || authenticatedUser?.email || qrPass?.email || "quester@blockquest.ph";
      const res = await fetch("/api/user/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quest_id: selectedQuest.id,
          user_email: email,
          xp: selectedQuest.xp,
          answer: selectedQuest.is_quiz ? quizAnswer : undefined,
          passcode: (selectedQuest.has_passcode || selectedQuest.passcode) ? passcodeAnswer : undefined,
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(json.error || "Claim error. Please try again.");
      }

      if (selectedQuest.requiresProof) {
        setClaimedQuestIds((prev) => [...prev, selectedQuest.id]);
      }
      setUserXp((prev) => prev + selectedQuest.xp);
      setQuests((prevQuests) =>
        prevQuests.map((q) => (q.id === selectedQuest.id ? { ...q, status: "Done" } : q))
      );
      if (selectedQuest.id === "register" || selectedQuest.id === "checkin") {
        setUserRank(6);
      }
      setPasscodeAnswer("");
      setQuizAnswer("");
      setSelectedQuest(null);
    } catch (err: any) {
      showNotice(err.message || "Claim error. Please try again.", "error", "Quest Claim Restricted", "🔒");
    } finally {
      setClaiming(false);
      fetchLeaderboard();
    }
  };

  const handleLinkTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticketPassword = "blockquest2026";
    const fullPhone = ticketCountryCode + ticketMobileNum;
    if (!ticketEmail.trim() || !ticketMobileNum.trim()) {
      setTicketError("Please enter both your email and mobile number.");
      return;
    }
    setTicketLoading(true);
    setTicketError("");
    try {
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ticketEmail.trim(),
          phone: fullPhone,
          password: ticketPassword,
          pincode: ticketPinCode.trim(),
        }),
      });
      const loginResult = await safeJson(loginResponse);
      if (!loginResponse.ok || !loginResult?.fullName || !loginResult.email) {
        if (loginResult?.requiresPin) {
          setShowPinInput(true);
        }
        setTicketError(loginResult?.error ?? "No matching ticket found with this email and phone.");
        setTicketLoading(false);
        return;
      }
      const qrResponse = await fetch("/api/qr-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ticketEmail.trim(), password: ticketPassword }),
      });
      const qrResult = await safeJson(qrResponse);
      if (!qrResponse.ok || !qrResult?.qrDataUrl || !qrResult.passCode) {
        setTicketError("Failed to fetch ticket credentials.");
        setTicketLoading(false);
        return;
      }
      setAuthenticatedUser({
        fullName: loginResult.fullName,
        email: loginResult.email,
        promoCode: loginResult.promoCode,
      });
      setQrPass({
        fullName: qrResult.fullName ?? loginResult.fullName,
        email: qrResult.email ?? loginResult.email,
        passCode: qrResult.passCode,
        qrDataUrl: qrResult.qrDataUrl,
      });

      if (loginResult?.requiresPinSetup) {
        setShowPinSetupModal(true);
      }

      const completedIds = loginResult.completedQuests || [];
      const hasRegister = completedIds.includes("register");
      const promoCode = loginResult.promoCode;

      // Restore existing completions and XP from database
      setQuests((prevQuests) =>
        prevQuests.map((q) => {
          if (q.id === "promo-bonus") {
            const isDone = completedIds.includes(q.id);
            return {
              ...q,
              title: promoCode ? `Promo Code Bonus (${promoCode})` : "Promo Code Bonus",
              description: promoCode
                ? `Claim your bonus 250 XP for registering with promo code: ${promoCode}`
                : "Claim your bonus XP for registering with an official promo code or referral link.",
              status: isDone ? "Done" : (promoCode ? "Live" : q.status),
            };
          }
          return completedIds.includes(q.id) ? { ...q, status: "Done" } : q;
        })
      );
      setUserXp(loginResult.totalXp || 0);

      // Only reward registration XP if they haven't claimed it yet
      if (!hasRegister) {
        setQuests((prevQuests) =>
          prevQuests.map((q) => (q.id === "register" ? { ...q, status: "Done" } : q))
        );
        setUserXp((prev) => prev + 250);
        try {
          await fetch("/api/user/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quest_id: "register",
              user_email: loginResult.email,
              xp: 250,
            }),
          });
        } catch (e) {
          console.error("Failed to auto-claim register quest", e);
        }
      }
    } catch (err: any) {
      setTicketError("An error occurred during verification.");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleSaveFirstPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinModalError("");
    const cleanPin = newPinInput.trim();
    if (!cleanPin || !/^\d{4,6}$/.test(cleanPin)) {
      setPinModalError("Security PIN must be 4 to 6 digits.");
      return;
    }
    if (cleanPin !== confirmPinInput.trim()) {
      setPinModalError("PIN codes do not match.");
      return;
    }
    setPinSaving(true);
    try {
      const res = await fetch("/api/user/pincode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authenticatedUser?.email || ticketEmail.trim(),
          pincode: cleanPin
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to set PIN code.");

      setShowPinSetupModal(false);
      setNewPinInput("");
      setConfirmPinInput("");
      showNotice("Security PIN code set successfully! Your account is now protected.", "success", "Security PIN Active", "🔒");
    } catch (err: any) {
      setPinModalError(err.message);
    } finally {
      setPinSaving(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinModalError("");
    const cleanCurrent = currentPinInput.trim();
    const cleanNew = newPinInput.trim();
    if (!cleanNew || !/^\d{4,6}$/.test(cleanNew)) {
      setPinModalError("New PIN must be 4 to 6 digits.");
      return;
    }
    if (cleanNew !== confirmPinInput.trim()) {
      setPinModalError("New PIN codes do not match.");
      return;
    }
    setPinSaving(true);
    try {
      const res = await fetch("/api/user/pincode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authenticatedUser?.email || ticketEmail.trim(),
          currentPincode: cleanCurrent,
          pincode: cleanNew
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to update Security PIN.");

      setShowChangePinModal(false);
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");
      showNotice("Security PIN code updated successfully!", "success", "Security PIN Updated", "🔒");
    } catch (err: any) {
      setPinModalError(err.message);
    } finally {
      setPinSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      {showIntro && (
        <ZealyIntroAnimation
          onComplete={() => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("bq_intro_seen", "true");
            }
            setShowIntro(false);
          }}
        />
      )}
      <main className="zealy-page">
      <div className="mobile-simulator">
        <div className="mobile-app">
          {/* Header */}
          <header className="zealy-header">
            <div className="zealy-header__brand">
              <div className="zealy-logo-box" style={{
                background: "linear-gradient(135deg, rgba(28, 24, 46, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%)",
                border: "1.5px solid rgba(245, 166, 35, 0.6)",
                boxShadow: "0 0 16px rgba(245, 166, 35, 0.35)",
                borderRadius: "14px",
                padding: "4px"
              }}>
                <img
                  src="/logo.png"
                  alt="BlockQuest Logo"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div>
                <p className="zealy-header__eyebrow">Fiesta Quest Game</p>
                <h1 className="zealy-header__title">BlockQuest Arena</h1>
              </div>
            </div>
            <div className="zealy-header__badge">
              <span>⚡ LVL {userLevel}</span>
            </div>
          </header>

          {/* Floating New Quest Notification Banner */}
          {newQuestAlert && (
            <div
              onClick={() => {
                setActiveTab("quests");
                setNewQuestAlert(null);
              }}
              style={{
                position: "absolute",
                top: 74,
                left: 14,
                right: 14,
                zIndex: 100,
                background: "linear-gradient(135deg, rgba(245, 166, 35, 0.98) 0%, rgba(224, 133, 11, 0.98) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                borderRadius: 16,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxShadow: "0 8px 24px rgba(245, 166, 35, 0.4)",
                cursor: "pointer",
                animation: "slideInDown 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem" }}>🔔</span>
                <div style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                  <div style={{ color: "#100b02", fontWeight: 900, fontSize: "0.86rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    🎉 New Quest Arrived! ({newQuestAlert.count})
                  </div>
                  <div style={{ color: "#2d1c03", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                    "{newQuestAlert.questTitle}"
                  </div>
                </div>
              </div>
              <span style={{
                background: "#100b02",
                color: "#fbbf24",
                padding: "4px 10px",
                borderRadius: 10,
                fontSize: "0.74rem",
                fontWeight: 800
              }}>
                View →
              </span>
            </div>
          )}

          <div className="app-content-scroll">
            {activeTab !== "profile" && activeTab !== "info" && (authenticatedUser || qrPass) && (
              <div className="xp-card">
                {authenticatedUser && (
                  <p style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 6,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}>
                    ⚡ {authenticatedUser.fullName || authenticatedUser.email}
                  </p>
                )}
                <div className="xp-card__info">
                  <div>
                    <p className="xp-card__label">Total Experience</p>
                    <h2 className="xp-card__value">{userXp} XP</h2>
                  </div>
                  <div className="xp-card__badge">
                    Rank #{userRank}
                  </div>
                </div>
                <div className="xp-card__bar-bg">
                  <div
                    className="xp-card__bar-fill"
                    style={{ width: `${xpProgressPercentage}%` }}
                  ></div>
                </div>
                <p className="xp-card__hint">
                  {300 - xpInCurrentLevel} XP until Level {userLevel + 1}
                </p>
              </div>
            )}
            {activeTab === "quests" && (
              <div className="zealy-tab-content">
                <div className="section-head" style={{ marginBottom: "2px", marginTop: "0px" }}>
                  <div>
                    <p className="section-head__eyebrow" style={{ fontSize: "0.64rem", marginBottom: "1px" }}>Available tasks</p>
                    <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 800 }}>Event Quests</h2>
                  </div>
                </div>

                {!authenticatedUser && !qrPass ? (
                  <div className="login-card" style={{ marginTop: 4, padding: "16px 14px", textAlign: "center", border: "1px solid rgba(245, 166, 35, 0.4)", background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(35, 25, 15, 0.95) 100%)" }}>
                    <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🔒</div>
                    <h3 style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>
                      Login Required to Play
                    </h3>
                    <p className="login-card__hint" style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                      Sign in with your registered email and 4-digit PIN to access live event quests, claim XP, and climb the leaderboard.
                    </p>
                    <form className="form" onSubmit={handleLinkTicket} style={{ textAlign: "left" }}>
                      <label style={{ gap: "4px" }}>
                        Email Address *
                        <input
                          type="email"
                          value={ticketEmail}
                          onChange={(e) => setTicketEmail(e.target.value)}
                          placeholder="quester@domain.com"
                          required
                          style={{ padding: "10px 12px", fontSize: "0.85rem" }}
                        />
                      </label>
                      <label style={{ gap: "4px", marginTop: "10px" }}>
                        Phone Number *
                        <div style={{ display: "flex", gap: "8px" }}>
                          <select
                            value={ticketCountryCode}
                            onChange={(e) => setTicketCountryCode(e.target.value)}
                            style={{ width: "95px", padding: "10px 6px", fontSize: "0.85rem", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "10px" }}
                          >
                            <option value="+63">🇵🇭 +63</option>
                            <option value="+1">🇺🇸 +1</option>
                            <option value="+65">🇸🇬 +65</option>
                            <option value="+81">🇯🇵 +81</option>
                            <option value="+44">🇬🇧 +44</option>
                          </select>
                          <input
                            type="tel"
                            value={ticketMobileNum}
                            onChange={handleTicketMobileChange}
                            placeholder="917 123 4567"
                            required
                            style={{ flex: 1, padding: "10px 12px", fontSize: "0.85rem" }}
                          />
                        </div>
                      </label>
                      {showPinInput && (
                        <>
                          <label style={{ gap: "4px", marginTop: "10px" }}>
                            🔒 Security PIN Code *
                            <input
                              type="password"
                              maxLength={6}
                              value={ticketPinCode}
                              onChange={(e) => setTicketPinCode(e.target.value.replace(/[^\d]/g, ""))}
                              placeholder="Enter 4-digit PIN (e.g. 1234)"
                              required
                              style={{ padding: "10px 12px", fontSize: "0.85rem", letterSpacing: "2px", fontWeight: "bold" }}
                            />
                          </label>
                          <p style={{ fontSize: "0.74rem", color: "rgba(245, 166, 35, 0.85)", marginTop: 6, marginBottom: 4, lineHeight: 1.4 }}>
                            💡 <strong>Forgot PIN?</strong> Please ask an Event Staff / Admin at the helpdesk to issue a temporary PIN code for your account.
                          </p>
                        </>
                      )}
                      {ticketError && (
                        <p style={{ color: "#f87171", fontSize: "0.78rem", margin: "6px 0 2px" }}>
                          {ticketError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={ticketLoading}
                        className="arena-cta-btn"
                      >
                        {ticketLoading ? "Verifying..." : "⚡ Unlock Quests (+250 XP)"}
                      </button>
                    </form>
                    <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.4)", marginTop: 14 }}>
                      Don't have a ticket yet? <Link href="/register" style={{ color: "#fbbf24", textDecoration: "underline" }}>Register Here</Link>
                    </p>
                  </div>
                ) : (
                  <div className="quest-list">
                    {/* Active / In Progress Quests */}
                    <div className="quest-category__title" style={{ marginTop: "2px", marginBottom: "2px", fontSize: "0.72rem" }}>
                      <span>⚡ Active Quests ({quests.filter((q) => q.status !== "Done").length})</span>
                    </div>

                    {quests
                      .filter((q) => q.status !== "Done")
                      .sort((a, b) => {
                        const orderA = (a as any).sort_order ?? 999;
                        const orderB = (b as any).sort_order ?? 999;
                        if (orderA !== orderB) return orderA - orderB; // ASC sort order
                        const timeA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
                        const timeB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
                        return timeA - timeB; // ASC date order
                      })
                      .map((q) => (
                      <div
                        key={q.id}
                        className={`quest-card quest-card--${q.status.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => handleQuestClick(q)}
                        style={
                          q.status === "Approved"
                            ? { border: "1px solid rgba(16, 185, 129, 0.5)", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(20, 20, 30, 0.9) 100%)" }
                            : q.status === "Rejected"
                              ? { border: "1px solid rgba(239, 68, 68, 0.5)", background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(20, 20, 30, 0.9) 100%)" }
                              : q.status === "Pending Verification"
                                ? { border: "1px solid rgba(245, 158, 11, 0.4)", background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 30, 0.9) 100%)" }
                                : undefined
                        }
                      >
                        <div className="quest-card__body">
                          <div className="quest-card__meta">
                            <span className={`category-badge category-badge--${q.category}`}>
                              {q.category}
                            </span>
                            <span className="xp-badge">+{q.xp} XP</span>
                            {q.passcode && (
                              <span style={{ fontSize: "0.64rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                🔑 Passcode
                              </span>
                            )}
                            {q.expires_at && (
                              <span style={{ fontSize: "0.64rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                                {new Date(q.expires_at).getTime() < Date.now() ? "⏳ Expired" : `⏱️ Ends ${new Date(q.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            )}
                            {q.depends_on_quest_id && !quests.some((p) => p.id === q.depends_on_quest_id && p.status === "Done") && (
                              <span style={{ fontSize: "0.64rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(100, 116, 139, 0.25)", color: "#94a3b8", border: "1px solid rgba(100, 116, 139, 0.4)" }}>
                                🔒 Prereq
                              </span>
                            )}
                            {q.requiresProof && q.status !== "Approved" && q.status !== "Pending Verification" && (
                              <span style={{ fontSize: "0.64rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(139, 92, 246, 0.2)", color: "#a78bfa", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
                                📷 Proof
                              </span>
                            )}
                            {q.requiresMessage && q.status !== "Approved" && q.status !== "Pending Verification" && (
                              <span style={{ fontSize: "0.64rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                💬 Note
                              </span>
                            )}
                          </div>
                          <h3 className="quest-card__title">{q.title}</h3>
                          <QuestCardDescription description={q.description} />
                        </div>
                        <div className="quest-card__footer">
                          {q.status === "Approved" ? (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.25)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.4)", fontWeight: 800 }}>
                              🎉 Ready to Claim XP →
                            </span>
                          ) : q.status === "Rejected" ? (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.25)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", fontWeight: 800 }}>
                              ❌ Rejected - Retry →
                            </span>
                          ) : q.status === "Pending Verification" ? (
                            <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.25)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)", fontWeight: 800 }}>
                              ⏳ Pending Review
                            </span>
                          ) : (
                            <span className={`status-badge status-badge--${q.status.toLowerCase().replace(/\s+/g, "-")}`}>
                              {q.status}
                            </span>
                          )}
                          {q.status !== "Soon" && q.status !== "Done" && q.status !== "Pending Verification" && q.status !== "Approved" && q.status !== "Rejected" && (
                            <span className="quest-card__arrow">→</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Completed Quests Toggle Section (STRICTLY Done ONLY) */}
                    {quests.filter((q) => q.status === "Done").length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <button
                          onClick={() => setShowCompletedQuests((prev) => !prev)}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderRadius: 14,
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            color: "var(--text-secondary)",
                            fontSize: "0.84rem",
                            fontWeight: 700,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span>
                            ✅ Completed Quests ({quests.filter((q) => q.status === "Done").length})
                          </span>
                          <span style={{ color: "var(--gold-light)", fontWeight: 800, fontSize: "0.85rem" }}>
                            {showCompletedQuests ? "Hide ▴" : "Show ▾"}
                          </span>
                        </button>

                        {showCompletedQuests && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                            {quests
                              .filter((q) => q.status === "Done")
                              .sort((a, b) => {
                                const timeA = (a as any).completedAt ? new Date((a as any).completedAt).getTime() : 0;
                                const timeB = (b as any).completedAt ? new Date((b as any).completedAt).getTime() : 0;
                                return timeA - timeB; // Ascending order
                              })
                              .map((q) => (
                              <div
                                key={q.id}
                                className={`quest-card quest-card--done`}
                                onClick={() => handleQuestClick(q)}
                                style={{ opacity: 0.82, background: "rgba(15, 15, 25, 0.55)", borderColor: "rgba(255, 255, 255, 0.05)" }}
                              >
                                <div className="quest-card__body">
                                  <div className="quest-card__meta">
                                    <span className={`category-badge category-badge--${q.category}`}>
                                      {q.category}
                                    </span>
                                    <span className="xp-badge" style={{
                                      background: "rgba(16, 185, 129, 0.2)",
                                      color: "#34d399",
                                      border: "1px solid rgba(16, 185, 129, 0.3)",
                                      boxShadow: "none"
                                    }}>
                                      +{q.xp} XP Claimed
                                    </span>
                                  </div>
                                  <h3 className="quest-card__title" style={{ textDecoration: "line-through", color: "var(--text-secondary)" }}>
                                    {q.title}
                                  </h3>
                                  <QuestCardDescription description={q.description} />
                                </div>
                                <div className="quest-card__footer">
                                  <span className="status-badge status-badge--done">
                                    ✓ Completed
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === "leaderboard" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Real-time stats</p>
                    <h2>Global Leaderboard</h2>
                  </div>
                </div>

                {/* Top 3 Podium Showcase */}
                <div className="leaderboard-podium">
                  {leaderboard.slice(0, 3).map((item) => (
                    <div key={item.rank} className={`podium-card podium-card--${item.rank}`}>
                      <div className="podium-badge">
                        {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉"}
                      </div>
                      <div className="podium-name">{item.name}</div>
                      <div className="podium-points">{item.points} XP</div>
                    </div>
                  ))}
                </div>

                <div className="leaderboard-list">
                  {leaderboard.map((item: any) => {
                    const myEmail = ticketEmail || authenticatedUser?.email || qrPass?.email;
                    const isCurrentUser = myEmail && item.email && item.email.toLowerCase() === myEmail.toLowerCase();

                    return (
                      <div
                        key={item.rank}
                        className={`leaderboard-item ${item.accent ?? ""}`}
                        style={
                          isCurrentUser
                            ? {
                              border: "1.5px solid var(--gold-light)",
                              background: "linear-gradient(135deg, rgba(245, 166, 35, 0.25) 0%, rgba(20, 20, 30, 0.95) 100%)",
                              boxShadow: "0 0 15px rgba(245, 166, 35, 0.35)",
                              transform: "scale(1.01)",
                            }
                            : undefined
                        }
                      >
                        <div className="leaderboard-item__rank" style={isCurrentUser ? { color: "var(--gold-light)", fontWeight: 900 } : undefined}>
                          #{item.rank}
                        </div>
                        <div className="leaderboard-item__info">
                          <div className="leaderboard-item__name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{item.name}</span>
                            {isCurrentUser && (
                              <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 8, background: "var(--gold-light)", color: "#000", fontWeight: 900, textTransform: "uppercase" }}>
                                YOU
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: isCurrentUser ? "var(--gold-light)" : "var(--text-secondary)" }}>
                            {isCurrentUser ? "🌟 Your Current Rank" : `Rank #${item.rank}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          <div className="leaderboard-item__xp" style={isCurrentUser ? { color: "#fff", fontWeight: 900, fontSize: "1rem" } : undefined}>
                            {item.points} XP
                          </div>
                          <div className="leaderboard-item__change">{item.change}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {activeTab === "info" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Event details</p>
                    <h2>Fiesta PH 2026</h2>
                  </div>
                </div>
                <article className="info-card">
                  <h3>📍 Event Location</h3>
                  <p>CABS Cabuyao City, Laguna, Philippines</p>
                  <a
                    href="https://maps.app.goo.gl/b4viLwYhJUQpGYiT9"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--gold-light)", fontSize: "0.8rem", textDecoration: "underline", display: "inline-block", marginTop: "4px" }}
                  >
                    View on Google Maps →
                  </a>
                </article>
                <article className="info-card">
                  <h3>🗓️ Date & Time</h3>
                  <p>Saturday, October 10, 2026 • 8:00 AM – 7:30 PM PHT</p>
                </article>
                <article className="info-card">
                  <h3>⚡ Event Highlights</h3>
                  <p style={{ marginBottom: "6px" }}>• <strong>Interactive Quests:</strong> Sponsor booth activations & ticket farming.</p>
                  <p style={{ marginBottom: "6px" }}>• <strong>Esports & Gaming:</strong> Tournaments and presentations.</p>
                  <p style={{ marginBottom: "6px" }}>• <strong>Talks & Panels:</strong> Web3, Crypto, and Forex discussions.</p>
                  <p>• <strong>Food Fair & Live Shows:</strong> Fiesta performances, food stalls, and prizes.</p>
                </article>
                <article className="info-card">
                  <h3>📅 Program Schedule</h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>8:00 AM - 2:00 PM</span>
                      <strong style={{ color: "#fff" }}>Registration</strong>
                    </li>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>8:00 AM - 5:00 PM</span>
                      <strong style={{ color: "var(--gold-light)" }}>🎯 Questing Time</strong>
                    </li>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>10:00 AM - 11:00 AM</span>
                      <strong style={{ color: "#fff" }}>Opening Ceremony</strong>
                    </li>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>11:00 AM - 12:00 PM</span>
                      <strong style={{ color: "#fff" }}>Panel Talks with Sponsors</strong>
                    </li>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>12:00 PM - 6:30 PM</span>
                      <strong style={{ color: "#fff" }}>Interactive Activities</strong>
                    </li>
                    <li style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>6:30 PM - 7:30 PM</span>
                      <strong style={{ color: "#fff" }}>Awardings & Closing</strong>
                    </li>
                  </ul>
                </article>
                <article className="info-card" style={{ textAlign: "center", background: "linear-gradient(135deg, rgba(245, 166, 35, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)", border: "1px solid rgba(245, 166, 35, 0.3)" }}>
                  <h3>🌐 Official Website</h3>
                  <p style={{ fontSize: "0.85rem", marginBottom: "10px" }}>Visit the official site for registrations, schedules, and more details.</p>
                  <a
                    href="https://block-quest.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="arena-cta-btn"
                    style={{ display: "inline-block", textDecoration: "none", width: "auto", padding: "8px 16px", fontSize: "0.85rem" }}
                  >
                    Visit block-quest.com
                  </a>
                </article>
              </div>
            )}
            {activeTab === "profile" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">User account</p>
                    <h2>Quester Profile</h2>
                  </div>
                </div>
                {qrPass ? (
                  <div className="qr-pass">
                    <div className="qr-pass__header">
                      <div>
                        <p className="qr-pass__eyebrow">Verified Ticket</p>
                        <h3>{qrPass.fullName}</h3>
                      </div>
                      <span className="qr-pass__code">{qrPass.passCode}</span>
                    </div>
                    <div className="qr-pass__body" style={{ gridTemplateColumns: "116px 1fr", alignItems: "center", gap: "14px" }}>
                      <div
                        onClick={() => setShowQrZoomModal(true)}
                        style={{
                          position: "relative",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "116px",
                          height: "116px",
                          cursor: "pointer",
                          borderRadius: "14px",
                          overflow: "hidden",
                          background: "#ffffff",
                          padding: "6px",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
                          border: "1px solid rgba(245, 166, 35, 0.3)"
                        }}
                        title="Click to Zoom QR Code"
                      >
                        <img
                          className="qr-pass__image"
                          src={qrPass.qrDataUrl}
                          alt="Ticket Pass"
                          style={{ width: "104px", height: "104px", display: "block", background: "#fff", padding: 0 }}
                        />
                      </div>
                      <div className="qr-pass__meta" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <strong style={{ fontSize: "0.92rem", color: "#fff", fontWeight: 800 }}>Entry QR Pass</strong>
                        <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{qrPass.email}</p>
                        <p style={{ fontSize: "0.72rem", color: "var(--gold-light)", fontWeight: 700 }}>✓ Ticket Linked (+250 XP)</p>
                        <button
                          type="button"
                          onClick={() => setShowQrZoomModal(true)}
                          style={{
                            marginTop: 4,
                            background: "rgba(245, 166, 35, 0.15)",
                            border: "1px solid rgba(245, 166, 35, 0.4)",
                            color: "var(--gold-light)",
                            borderRadius: 6,
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            width: "fit-content"
                          }}
                        >
                          🔍 Zoom for Scanner
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="login-card" style={{ marginTop: 0 }}>
                    <div className="section-head" style={{ marginBottom: "8px" }}>
                      <div>
                        <p className="section-head__eyebrow">Link Event Ticket</p>
                        <h3 style={{ color: "#fff", fontWeight: 700 }}>Unlock Ticket Profile</h3>
                      </div>
                    </div>
                    <p className="login-card__hint" style={{ fontSize: "0.78rem" }}>
                      Enter your registered email & phone number to link your ticket pass and claim +250 XP instantly!
                    </p>
                    <form className="form" onSubmit={handleLinkTicket}>
                      <label style={{ gap: "4px" }}>
                        Email Address
                        <input
                          type="email"
                          value={ticketEmail}
                          onChange={(e) => setTicketEmail(e.target.value)}
                          placeholder="mara@studio.com"
                          required
                          style={{ padding: "10px 12px", fontSize: "0.85rem" }}
                        />
                      </label>
                      <label style={{ gap: "4px", marginTop: "8px" }}>
                        Phone Number *
                        <div style={{ display: "flex", gap: "8px" }}>
                          <select
                            value={ticketCountryCode}
                            onChange={(e) => setTicketCountryCode(e.target.value)}
                            style={{ width: "95px", padding: "10px 6px", fontSize: "0.85rem", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "10px" }}
                          >
                            <option value="+63">🇵🇭 +63</option>
                            <option value="+1">🇺🇸 +1</option>
                            <option value="+65">🇸🇬 +65</option>
                            <option value="+81">🇯🇵 +81</option>
                            <option value="+44">🇬🇧 +44</option>
                          </select>
                          <input
                            type="tel"
                            value={ticketMobileNum}
                            onChange={handleTicketMobileChange}
                            placeholder="917 123 4567"
                            required
                            style={{ flex: 1, padding: "10px 12px", fontSize: "0.85rem" }}
                          />
                        </div>
                      </label>
                      {ticketError && (
                        <p style={{ color: "#f87171", fontSize: "0.78rem", margin: "6px 0 2px" }}>
                          {ticketError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={ticketLoading}
                        className="arena-cta-btn"
                        style={{ marginTop: "12px" }}
                      >
                        {ticketLoading ? "Verifying Ticket..." : "⚡ Link Ticket & Claim +250 XP"}
                      </button>
                    </form>
                  </div>
                )}
                <div className="info-card" style={{ display: "flex", justifyContent: "space-between", padding: "14px" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total Points</p>
                    <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{userXp} XP</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Global Rank</p>
                    <strong style={{ fontSize: "1.2rem", color: "var(--gold-light)" }}>#{userRank}</strong>
                  </div>
                </div>

                {/* 🏆 Milestone Badges & Achievements */}
                <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                      🏆 Milestone Badges & Tiers
                    </h3>
                    <span style={{ fontSize: "0.7rem", color: "#fbbf24", fontWeight: 700 }}>
                      {userXp} Total XP
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, maxHeight: "230px", overflowY: "auto", paddingRight: 2 }}>
                    {[
                      { name: "Rookie Quester", xp: 500, icon: "🥉", color: "#cd7f32" },
                      { name: "Explorer", xp: 1200, icon: "🥈", color: "#94a3b8" },
                      { name: "Challenger", xp: 2500, icon: "⚔️", color: "#34d399" },
                      { name: "Master Quester", xp: 5000, icon: "🥇", color: "#ffd700" },
                      { name: "Diamond Hero", xp: 10000, icon: "💎", color: "#38bdf8" },
                      { name: "Fiesta Legend", xp: 20000, icon: "👑", color: "#c084fc" },
                      { name: "Grandmaster", xp: 35000, icon: "⚡", color: "#fbbf24" },
                      { name: "Mythic Sovereign", xp: 50000, icon: "🌌", color: "#f472b6" },
                    ].map((b) => {
                      const unlocked = userXp >= b.xp;
                      return (
                        <div
                          key={b.name}
                          style={{
                            background: unlocked ? "rgba(255,255,255,0.06)" : "rgba(10, 14, 24, 0.45)",
                            border: `1px solid ${unlocked ? b.color : "rgba(255,255,255,0.07)"}`,
                            borderRadius: "8px",
                            padding: "6px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: unlocked ? 1 : 0.4,
                            boxShadow: unlocked ? `0 0 10px ${b.color}22` : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span style={{ fontSize: "1.1rem", filter: unlocked ? "none" : "grayscale(100%)" }}>
                            {unlocked ? b.icon : "🔒"}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: "0.73rem", fontWeight: 800, color: unlocked ? "#f8fafc" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {b.name}
                            </span>
                            <span style={{ fontSize: "0.62rem", color: unlocked ? b.color : "#64748b", fontWeight: unlocked ? 700 : 400 }}>
                              {unlocked ? "✓ Unlocked" : `${b.xp} XP needed`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* User Activity & Submission History */}
                <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                      📜 Quest Activity & Proof Log
                    </h3>
                    <button
                      onClick={fetchUserVerifications}
                      style={{ background: "none", border: "none", color: "var(--gold-light)", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      ↻ Refresh
                    </button>
                  </div>

                  {(() => {
                    const instantLogs = (completedQuestRecords || []).map((c: any) => {
                      const matchingQuest = quests.find((q) => q.id === c.quest_id);
                      const title =
                        c.quest_id === "register"
                          ? "⚡ Register for BlockQuest Fiesta PH"
                          : c.quest_id === "checkin"
                            ? "🎟️ Gate Entrance Check-in"
                            : matchingQuest?.title || `Quest: ${c.quest_id}`;
                      const xp = c.xp_awarded || matchingQuest?.xp || (c.quest_id === "register" ? 250 : 100);
                      return {
                        uniqueKey: `instant_${c.quest_id}`,
                        quest_id: c.quest_id,
                        quest_title: title,
                        xp,
                        status: "Approved",
                        displayStatus: "✓ Claimed",
                        created_at: c.completed_at || new Date().toISOString(),
                        is_instant: true,
                      };
                    });

                    // Ensure registration reward appears for logged-in attendees
                    if (
                      (authenticatedUser || qrPass || ticketEmail) &&
                      !instantLogs.some((l) => l.quest_id === "register")
                    ) {
                      instantLogs.unshift({
                        uniqueKey: "instant_register_default",
                        quest_id: "register",
                        quest_title: "⚡ Register for BlockQuest Fiesta PH",
                        xp: 250,
                        status: "Approved",
                        displayStatus: "✓ Claimed",
                        created_at: new Date().toISOString(),
                        is_instant: true,
                      });
                    }

                    const filteredVerifs = (userVerifications || []).filter(
                      (v: any) => !instantLogs.some((l) => l.quest_id === v.quest_id && l.status === "Approved")
                    );

                    const displayLogs = [...instantLogs, ...filteredVerifs].sort(
                      (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                    );

                    if (displayLogs.length === 0) {
                      return (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "4px 0" }}>
                          No quest activities recorded yet. Complete quests to track XP rewards here!
                        </p>
                      );
                    }

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "300px", overflowY: "auto", paddingRight: 2 }}>
                        {displayLogs.map((v, idx) => {
                          const formattedDate = v.created_at
                            ? new Date(v.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";

                          return (
                            <div
                              key={v.uniqueKey || `${v.id || v.quest_id}_${idx}`}
                              style={{
                                background: "rgba(15, 20, 32, 0.75)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: 10,
                                padding: "8px 10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                                  <strong style={{ fontSize: "0.81rem", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {v.quest_title}
                                  </strong>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.68rem" }}>
                                    <span style={{ color: "#fbbf24", fontWeight: 700 }}>+{v.xp} XP</span>
                                    {formattedDate && <span style={{ color: "#94a3b8", opacity: 0.8 }}>• {formattedDate}</span>}
                                  </div>
                                </div>

                                <span
                                  style={{
                                    fontSize: "0.66rem",
                                    fontWeight: 800,
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    background:
                                      v.status === "Approved"
                                        ? "rgba(16, 185, 129, 0.16)"
                                        : v.status === "Rejected"
                                          ? "rgba(239, 68, 68, 0.16)"
                                          : "rgba(245, 158, 11, 0.16)",
                                    color:
                                      v.status === "Approved"
                                        ? "#34d399"
                                        : v.status === "Rejected"
                                          ? "#f87171"
                                          : "#fbbf24",
                                    border:
                                      v.status === "Approved"
                                        ? "1px solid rgba(16, 185, 129, 0.3)"
                                        : v.status === "Rejected"
                                          ? "1px solid rgba(239, 68, 68, 0.3)"
                                          : "1px solid rgba(245, 158, 11, 0.3)",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0
                                  }}
                                >
                                  {v.status === "Approved" ? (v.displayStatus || "✓ Claimed") : v.status === "Rejected" ? "✕ Rejected" : "⏳ Pending"}
                                </span>
                              </div>

                              {v.user_message && (
                                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 6, fontStyle: "italic" }}>
                                  💬 "{v.user_message}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                {qrPass && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => {
                        setPinModalError("");
                        setCurrentPinInput("");
                        setNewPinInput("");
                        setConfirmPinInput("");
                        setShowChangePinModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 12,
                        border: "1px solid rgba(245, 166, 35, 0.4)",
                        background: "rgba(245, 166, 35, 0.08)",
                        color: "#fbbf24",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      }}
                    >
                      🔒 Security PIN & Account Protection
                    </button>

                    <button
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 12,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.07)",
                        color: "#f87171",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      🔓 Logout / Switch Account
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <nav className="app-tabs">
            <button
              onClick={() => {
                setActiveTab("quests");
                setNewQuestAlert(null);
              }}
              className={`tab-btn tab-btn--relative ${activeTab === "quests" ? "tab-btn--active" : ""}`}
            >
              <span className="tab-icon tab-icon--relative">
                🎯
                {(newQuestAlert || quests.some((q) => q.status === "Approved" || q.status === "Rejected")) && (
                  <span className="tab-unread-dot" />
                )}
              </span>
              <span className="tab-label">Quests</span>
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`tab-btn ${activeTab === "leaderboard" ? "tab-btn--active" : ""}`}
            >
              <span className="tab-icon">🏆</span>
              <span className="tab-label">Rank</span>
            </button>
            <button
              onClick={() => setActiveTab("info")}
              className={`tab-btn ${activeTab === "info" ? "tab-btn--active" : ""}`}
            >
              <span className="tab-icon">ℹ️</span>
              <span className="tab-label">Info</span>
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`tab-btn ${activeTab === "profile" ? "tab-btn--active" : ""}`}
            >
              <span className="tab-icon">👤</span>
              <span className="tab-label">Profile</span>
            </button>
          </nav>
          {selectedQuest && (() => {
            const liveQuest = quests.find((q) => q.id === selectedQuest.id) || selectedQuest;
            const isCompleted = liveQuest.status === "Done" || liveQuest.status === "Approved";
            const isPending = liveQuest.status === "Pending Verification";
            return (
              <div className="modal-overlay">
                <div className="modal-content" style={{ maxHeight: "85vh", overflowY: "auto", overscrollBehavior: "contain" }}>
                  <div className="modal-header" style={{ position: "sticky", top: 0, background: "rgba(22, 22, 40, 0.95)", backdropFilter: "blur(8px)", zIndex: 10, paddingTop: 4, paddingBottom: 6, marginTop: -6 }}>
                    <h2>{liveQuest.title}</h2>
                    <button
                      className="modal-close-btn"
                      onClick={() => {
                        setSelectedQuest(null);
                        setProofImage(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="modal-xp-reward">Reward: {liveQuest.xp} XP</div>
                  <p className="modal-body" style={{ whiteSpace: "pre-wrap" }}>{liveQuest.description}</p>
                  {(() => {
                    if (isCompleted) {
                    return (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "14px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34d399",
                          borderRadius: "12px",
                          fontWeight: 800,
                          border: "1px solid rgba(16, 185, 129, 0.3)"
                        }}
                      >
                        🎉 Quest Approved & Completed! (+{liveQuest.xp} XP)
                      </div>
                    );
                  }

                  if (isPending) {
                    return (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "14px",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                          border: "1px solid rgba(245, 166, 35, 0.3)",
                          borderRadius: "12px",
                          fontWeight: 700,
                        }}
                      >
                        ⏳ Proof / Message Submitted! Awaiting Admin Verification.
                      </div>
                    );
                  }

                  return (
                    <>
                      {(() => {
                        const hasAction = !!selectedQuest.actionUrl;
                        const isActionCompleted = !hasAction || !!visitedActions[selectedQuest.id];
                        return (
                          <>
                            {selectedQuest.actionUrl && (
                              <Link
                                href={selectedQuest.actionUrl}
                                target={selectedQuest.actionUrl.startsWith("http") ? "_blank" : undefined}
                                className="modal-action-btn"
                                style={{
                                  textAlign: "center",
                                  marginBottom: 12,
                                  background: isActionCompleted
                                    ? "rgba(16, 185, 129, 0.2)"
                                    : "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                                  borderColor: isActionCompleted ? "rgba(16, 185, 129, 0.4)" : undefined,
                                  color: isActionCompleted ? "#34d399" : "#100b02",
                                  fontWeight: 800,
                                }}
                                onClick={() => {
                                  setVisitedActions((prev) => ({ ...prev, [selectedQuest.id]: true }));
                                  if (selectedQuest.id === "register") {
                                    setSelectedQuest(null);
                                    setActiveTab("profile");
                                  }
                                }}
                              >
                                {isActionCompleted
                                  ? `✓ Task Visited (${selectedQuest.actionLabel ?? "Done"})`
                                  : `⚡ ${selectedQuest.actionLabel ?? "Complete Task"} →`}
                              </Link>
                            )}

                            {hasAction && !isActionCompleted && (
                              <div style={{
                                background: "rgba(245, 158, 11, 0.12)",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                padding: "10px 14px",
                                borderRadius: 12,
                                color: "#fbbf24",
                                fontSize: "0.8rem",
                                marginBottom: 12,
                                fontWeight: 700,
                                textAlign: "center"
                              }}>
                                ⚠️ Complete Task: Click the action button above to perform the task before claiming.
                              </div>
                            )}

                            {liveQuest.status === "Rejected" && (() => {
                              const lastVerif = userVerifications.find((v) => v.quest_id === liveQuest.id);
                              return (
                                <div style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid rgba(239, 68, 68, 0.35)",
                                  padding: "14px 16px",
                                  borderRadius: 14,
                                  marginBottom: 16
                                }}>
                                  <div style={{ color: "#f87171", fontWeight: 800, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>✕</span> Submission Rejected by Admin
                                  </div>
                                  {lastVerif?.rejection_reason && (
                                    <div style={{ color: "#fca5a5", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                      💬 <strong>Reason:</strong> "{lastVerif.rejection_reason}"
                                    </div>
                                  )}
                                  <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: 6 }}>
                                    Please update your note/screenshot below and resubmit for admin review.
                                  </div>
                                </div>
                              );
                            })()}

                            {(selectedQuest.requiresProof || selectedQuest.requiresMessage) && selectedQuest.status !== "Approved" ? (
                              <div style={{
                                marginTop: 12,
                                marginBottom: 16,
                                background: "rgba(18, 19, 32, 0.85)",
                                padding: "18px 16px",
                                borderRadius: 16,
                                border: "1px solid rgba(245, 166, 35, 0.25)",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
                              }}>
                                {/* Messagebox or Social Post Link Input */}
                                {selectedQuest.requiresMessage && (() => {
                                  const isSocial = isSocialLinkQuest(selectedQuest);
                                  const socialCheck = isSocial ? isStrictSocialLink(userMessageInput) : null;

                                  if (isSocial) {
                                    return (
                                      <div style={{ marginBottom: selectedQuest.requiresProof ? 14 : 0 }}>
                                        <div style={{
                                          background: "linear-gradient(135deg, rgba(24, 119, 242, 0.1) 0%, rgba(225, 48, 108, 0.1) 100%)",
                                          border: "1px solid rgba(24, 119, 242, 0.3)",
                                          borderRadius: 14,
                                          padding: "14px 14px",
                                          marginBottom: 12
                                        }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span style={{ fontSize: "1.2rem" }}>🤳</span>
                                            <strong style={{ fontSize: "0.88rem", color: "#fff" }}>
                                              Selfie Post Verification (FB / IG)
                                            </strong>
                                          </div>
                                          <p style={{ fontSize: "0.76rem", color: "rgba(255, 255, 255, 0.8)", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                                            1. Take a selfie with the speaker.<br />
                                            2. Post it publicly on your <strong>Facebook</strong> or <strong>Instagram</strong> feed with photo, caption & hashtag <strong>#BlockQuestFiestaPH</strong>.<br />
                                            3. Paste your public post link below.
                                          </p>
                                          <div style={{ display: "flex", gap: 8 }}>
                                            <a
                                              href="https://www.facebook.com"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                padding: "4px 10px",
                                                borderRadius: 8,
                                                background: "rgba(24, 119, 242, 0.25)",
                                                border: "1px solid rgba(24, 119, 242, 0.5)",
                                                color: "#60a5fa",
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                textDecoration: "none"
                                              }}
                                            >
                                              📘 Open Facebook ↗
                                            </a>
                                            <a
                                              href="https://www.instagram.com"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                padding: "4px 10px",
                                                borderRadius: 8,
                                                background: "rgba(225, 48, 108, 0.25)",
                                                border: "1px solid rgba(225, 48, 108, 0.5)",
                                                color: "#f472b6",
                                                fontSize: "0.72rem",
                                                fontWeight: 700,
                                                textDecoration: "none"
                                              }}
                                            >
                                              📷 Open Instagram ↗
                                            </a>
                                          </div>
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                          <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--gold-light)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>🔗</span> Paste Post Link (Required)
                                          </span>
                                          {userMessageInput.trim() && (
                                            <span style={{
                                              fontSize: "0.7rem",
                                              fontWeight: 700,
                                              color: socialCheck?.valid ? "#34d399" : "#f87171"
                                            }}>
                                              {socialCheck?.valid
                                                ? socialCheck.platform === "facebook" ? "✓ Valid Facebook Link" : "✓ Valid Instagram Link"
                                                : "✕ Only FB/IG links allowed"}
                                            </span>
                                          )}
                                        </div>

                                        <input
                                          type="url"
                                          value={userMessageInput}
                                          onChange={(e) => setUserMessageInput(e.target.value)}
                                          placeholder="https://www.facebook.com/... or https://www.instagram.com/p/..."
                                          disabled={!isActionCompleted}
                                          style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            borderRadius: 12,
                                            background: "rgba(11, 15, 25, 0.9)",
                                            border: userMessageInput.trim()
                                              ? (socialCheck?.valid ? "1px solid #10b981" : "1px solid #ef4444")
                                              : "1px solid rgba(245, 166, 35, 0.35)",
                                            color: "#fff",
                                            fontSize: "0.88rem",
                                            outline: "none",
                                            boxSizing: "border-box"
                                          }}
                                        />
                                        <small style={{ display: "block", marginTop: 4, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                          🔒 Strictly accepts public posts on facebook.com or instagram.com only.
                                        </small>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div style={{ marginBottom: selectedQuest.requiresProof ? 14 : 0 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span style={{ fontSize: "1.1rem" }}>💬</span>
                                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gold-light)" }}>
                                            Messagebox (Required)
                                          </span>
                                        </div>
                                        <span style={{ fontSize: "0.72rem", color: userMessageInput.length >= 250 ? "#ef4444" : "var(--text-muted)", fontWeight: 700 }}>
                                          {userMessageInput.length}/250
                                        </span>
                                      </div>
                                      <textarea
                                        rows={2}
                                        maxLength={250}
                                        value={userMessageInput}
                                        onChange={(e) => setUserMessageInput(e.target.value.slice(0, 250))}
                                        placeholder="Type your note for the admin..."
                                        style={{
                                          width: "100%",
                                          padding: "10px 14px",
                                          borderRadius: 12,
                                          background: "rgba(11, 15, 25, 0.85)",
                                          border: userMessageInput.length >= 250 ? "1px solid #ef4444" : "1px solid rgba(245, 166, 35, 0.3)",
                                          color: "#fff",
                                          fontSize: "0.85rem",
                                          outline: "none",
                                          resize: "vertical",
                                          boxSizing: "border-box"
                                        }}
                                      />
                                    </div>
                                  );
                                })()}

                                {selectedQuest.requiresProof && (
                                  <>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <span style={{ fontSize: "1.1rem" }}>📷</span>
                                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--gold-light)" }}>
                                        Upload Proof Screenshot Required
                                      </span>
                                    </div>

                                    {/* Hidden Native File Input */}
                                    <input
                                      id="proof-screenshot-upload"
                                      type="file"
                                      accept="image/*"
                                      onChange={handleProofImageChange}
                                      disabled={!isActionCompleted}
                                      style={{ display: "none" }}
                                    />

                                    {/* Custom Dropzone / Upload Trigger Button */}
                                    {!proofImage ? (
                                      <label
                                        htmlFor="proof-screenshot-upload"
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 8,
                                          padding: "20px 16px",
                                          borderRadius: 14,
                                          border: isActionCompleted ? "2px dashed rgba(245, 166, 35, 0.4)" : "2px dashed rgba(255, 255, 255, 0.1)",
                                          background: isActionCompleted
                                            ? "radial-gradient(ellipse at 50% 50%, rgba(245, 166, 35, 0.08) 0%, rgba(168, 85, 247, 0.04) 100%)"
                                            : "rgba(0, 0, 0, 0.3)",
                                          cursor: isActionCompleted ? "pointer" : "not-allowed",
                                          opacity: isActionCompleted ? 1 : 0.6,
                                          transition: "all 0.25s ease"
                                        }}
                                      >
                                        <div style={{
                                          width: 48,
                                          height: 48,
                                          borderRadius: 14,
                                          background: isActionCompleted ? "rgba(245, 166, 35, 0.15)" : "rgba(255,255,255,0.05)",
                                          border: isActionCompleted ? "1px solid rgba(245, 166, 35, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "1.5rem"
                                        }}>
                                          {isActionCompleted ? "📸" : "🔒"}
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                          <strong style={{ fontSize: "0.88rem", color: isActionCompleted ? "#fff" : "var(--text-muted)", display: "block" }}>
                                            {isActionCompleted ? "Tap to Choose Screenshot" : "Complete Task Above First"}
                                          </strong>
                                          <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                                            {isActionCompleted ? "Supports PNG, JPG, WEBP photos" : "Click action button above to unlock proof upload"}
                                          </span>
                                        </div>
                                      </label>
                                    ) : (
                                      /* Screenshot Selected Preview Box */
                                      <div style={{
                                        background: "rgba(0, 0, 0, 0.4)",
                                        border: "1px solid rgba(168, 85, 247, 0.4)",
                                        borderRadius: 14,
                                        padding: 14,
                                        textAlign: "center"
                                      }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#c084fc", display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>✅</span> Screenshot Loaded
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setProofImage(null)}
                                            style={{
                                              background: "rgba(239, 68, 68, 0.15)",
                                              border: "1px solid rgba(239, 68, 68, 0.3)",
                                              color: "#f87171",
                                              fontSize: "0.72rem",
                                              fontWeight: 700,
                                              padding: "4px 8px",
                                              borderRadius: 6,
                                              cursor: "pointer"
                                            }}
                                          >
                                            ✕ Remove
                                          </button>
                                        </div>

                                        <div style={{ position: "relative", display: "inline-block" }}>
                                          <img
                                            src={proofImage}
                                            alt="Screenshot Proof Preview"
                                            style={{
                                              maxHeight: 180,
                                              maxWidth: "100%",
                                              borderRadius: 10,
                                              border: "2px solid rgba(168, 85, 247, 0.5)",
                                              boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                                            }}
                                          />
                                        </div>

                                        <label
                                          htmlFor="proof-screenshot-upload"
                                          style={{
                                            display: "block",
                                            marginTop: 10,
                                            fontSize: "0.75rem",
                                            color: "#60a5fa",
                                            fontWeight: 700,
                                            textDecoration: "underline",
                                            cursor: "pointer"
                                          }}
                                        >
                                          🔄 Choose Different Image
                                        </label>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Submit Proof / Message Button */}
                                {(() => {
                                  const isSocial = isSocialLinkQuest(selectedQuest);
                                  const socialCheck = isSocial ? isStrictSocialLink(userMessageInput) : null;
                                  const isReady = isActionCompleted && (
                                    (selectedQuest.requiresProof ? !!proofImage : true) &&
                                    (selectedQuest.requiresMessage
                                      ? (isSocial ? (socialCheck?.valid ?? false) : !!userMessageInput.trim())
                                      : (!!proofImage || !!userMessageInput.trim()))
                                  );

                                  return (
                                    <button
                                      onClick={handleSubmitProof}
                                      disabled={proofSubmitting || !isReady}
                                      className="modal-claim-btn"
                                      style={{
                                        marginTop: 16,
                                        width: "100%",
                                        padding: "14px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "0.9rem",
                                        border: "none",
                                        background: isReady
                                          ? "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)"
                                          : "rgba(255, 255, 255, 0.08)",
                                        color: isReady ? "#fff" : "rgba(255, 255, 255, 0.4)",
                                        boxShadow: isReady ? "0 0 25px rgba(168, 85, 247, 0.4)" : "none",
                                        opacity: isReady ? 1 : 0.6,
                                        cursor: isReady ? "pointer" : "not-allowed",
                                        transition: "all 0.25s ease"
                                      }}
                                    >
                                      {proofSubmitting
                                        ? "⏳ Submitting for Verification..."
                                        : isReady
                                          ? selectedQuest.status === "Rejected" ? "📤 Resubmit for Verification →" : "📤 Submit Verification →"
                                          : !isActionCompleted
                                            ? "🔒 Complete Task First"
                                            : isSocial
                                              ? (userMessageInput.trim() ? "⚠️ Paste Valid Facebook/Instagram Post Link" : "🔗 Paste Public Post Link Above")
                                              : selectedQuest.requiresMessage && !userMessageInput.trim()
                                                ? "💬 Please Enter Your Message Above"
                                                : "📷 Select Screenshot / Fill Message"}
                                    </button>
                                  );
                                })()}
                              </div>
                            ) : selectedQuest.is_quiz ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                <input
                                  type="text"
                                  placeholder="Enter quiz answer..."
                                  value={quizAnswer}
                                  onChange={(e) => setQuizAnswer(e.target.value)}
                                  style={{
                                    padding: "14px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    background: "rgba(0, 0, 0, 0.4)",
                                    color: "#fff",
                                    fontSize: "1rem"
                                  }}
                                />
                                <button
                                  onClick={handleClaimXp}
                                  disabled={claiming || !quizAnswer.trim() || !isActionCompleted}
                                  className="modal-claim-btn"
                                  style={{
                                    opacity: (quizAnswer.trim() && isActionCompleted) ? 1 : 0.5,
                                    cursor: (quizAnswer.trim() && isActionCompleted) ? "pointer" : "not-allowed",
                                    background: (quizAnswer.trim() && isActionCompleted) ? "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)" : "rgba(255,255,255,0.1)"
                                  }}
                                >
                                  {claiming ? "Claiming..." : isActionCompleted ? "Submit Answer & Claim XP" : "🔒 Complete Task First"}
                                </button>
                              </div>
                            ) : selectedQuest.id === "checkin" ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                {isGateCheckedIn ? (
                                  <>
                                    <div style={{
                                      background: "rgba(16, 185, 129, 0.15)",
                                      border: "1px solid rgba(16, 185, 129, 0.4)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🎟️ ✅</div>
                                      <div style={{ color: "#34d399", fontWeight: 800, fontSize: "1rem" }}>
                                        Entrance Gate Check-in Verified!
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        Your ticket pass was scanned at the entrance gate. Click below to claim your reward!
                                      </div>
                                    </div>
                                    <button
                                      onClick={handleClaimXp}
                                      disabled={claiming}
                                      className="modal-claim-btn"
                                      style={{
                                        width: "100%",
                                        padding: "15px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "1rem",
                                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                        color: "#fff",
                                        border: "none",
                                        cursor: "pointer",
                                        boxShadow: "0 0 25px rgba(16, 185, 129, 0.4)",
                                      }}
                                    >
                                      {claiming ? "Claiming +500 XP..." : "🎉 Claim +500 Check-in XP →"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{
                                      background: "rgba(245, 158, 11, 0.12)",
                                      border: "1px solid rgba(245, 158, 11, 0.35)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🚪 🔒</div>
                                      <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1rem" }}>
                                        Physical Gate Check-in Required
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        Scan your QR ticket pass at the event entrance gate on Saturday, Oct 10. Once scanned by gate staff, this 500 XP reward unlocks automatically for claim!
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedQuest(null);
                                        setActiveTab("profile");
                                      }}
                                      className="modal-claim-btn"
                                      style={{
                                        width: "100%",
                                        padding: "14px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "0.9rem",
                                        background: "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                                        color: "#100b02",
                                        border: "none",
                                        cursor: "pointer",
                                      }}
                                    >
                                      🎫 View My QR Ticket Pass →
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (selectedQuest.has_passcode || selectedQuest.passcode) ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, padding: 10, fontSize: "0.82rem", color: "#fbbf24" }}>
                                  🔑 <strong>Passcode Required:</strong> Ask the booth staff or stage presenter for the secret code.
                                </div>
                                <input
                                  type="text"
                                  placeholder="ENTER SECRET PASSCODE (e.g. BOOTH-07)..."
                                  value={passcodeAnswer}
                                  onChange={(e) => setPasscodeAnswer(e.target.value.toUpperCase())}
                                  style={{
                                    padding: "14px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(245, 158, 11, 0.4)",
                                    background: "rgba(0, 0, 0, 0.5)",
                                    color: "#fbbf24",
                                    fontSize: "1.05rem",
                                    fontWeight: 800,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                  }}
                                />
                                <button
                                  onClick={handleClaimXp}
                                  disabled={claiming || !passcodeAnswer.trim() || !isActionCompleted}
                                  className="modal-claim-btn"
                                  style={{
                                    opacity: (passcodeAnswer.trim() && isActionCompleted) ? 1 : 0.5,
                                    cursor: (passcodeAnswer.trim() && isActionCompleted) ? "pointer" : "not-allowed",
                                    background: (passcodeAnswer.trim() && isActionCompleted) ? "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)" : "rgba(255,255,255,0.1)"
                                  }}
                                >
                                  {claiming ? "Claiming..." : isActionCompleted ? "Unlock Passcode & Claim XP" : "🔒 Complete Task First"}
                                </button>
                              </div>
                            ) : selectedQuest.id === "discord-member" ? (
                              <button
                                onClick={() => {
                                  const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
                                  if (!email) {
                                    showNotice("Please register or log in first before claiming Discord XP.", "warning", "Login Required", "🔑");
                                    return;
                                  }
                                  window.location.href = `/api/auth/discord?email=${encodeURIComponent(email)}&quest_id=${selectedQuest.id}`;
                                }}
                                className="modal-claim-btn"
                                style={{
                                  width: "100%",
                                  padding: "14px",
                                  borderRadius: 12,
                                  fontWeight: 800,
                                  fontSize: "0.95rem",
                                  background: "linear-gradient(135deg, #5865F2 0%, #404EED 100%)",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  boxShadow: "0 0 20px rgba(88, 101, 242, 0.4)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                  marginTop: 12
                                }}
                              >
                                💬 Authorize & Verify Discord Membership →
                              </button>
                             ) : (
                              <button
                                onClick={handleClaimXp}
                                disabled={claiming || !isActionCompleted}
                                className="modal-claim-btn"
                                style={{
                                  opacity: isActionCompleted ? 1 : 0.5,
                                  cursor: isActionCompleted ? "pointer" : "not-allowed",
                                  background: isActionCompleted ? "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)" : "rgba(255,255,255,0.1)"
                                }}
                              >
                                {claiming ? "Claiming..." : isActionCompleted ? "Claim XP Reward" : "🔒 Complete Task First"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })()}
          {inactivityWarning && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ textAlign: "center", padding: "24px", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "4px" }}>⏳</div>
                <h2 style={{ color: "#fbbf24", marginBottom: "2px", fontSize: "1.2rem", fontWeight: 800 }}>Are you still there?</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.4 }}>
                  You have been inactive. You will be logged out automatically in <strong style={{ color: "#f87171" }}>{inactivityCountdown} seconds</strong>.
                </p>
                <button
                  onClick={resetInactivityTimer}
                  className="arena-cta-btn"
                  style={{ width: "100%", padding: "12px", marginTop: 0, fontSize: "0.88rem" }}
                >
                  ⚡ Stay Logged In
                </button>
              </div>
            </div>
          )}

          {/* First-Time PIN Setup Modal */}
          {showPinSetupModal && authenticatedUser && (
            <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.85)", zIndex: 99999 }}>
              <div className="modal-content" style={{ maxWidth: 350, padding: 24, textAlign: "center", background: "#121723", border: "1px solid rgba(245, 166, 35, 0.4)", borderRadius: 16 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 6 }}>🔒</div>
                <h2 style={{ color: "#fbbf24", margin: "0 0 6px", fontSize: "1.2rem", fontWeight: 800 }}>
                  Set Security PIN Code
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: 16, lineHeight: 1.4 }}>
                  Protect your account! Set a 4 to 6-digit Security PIN code for your future logins.
                </p>

                <form onSubmit={handleSaveFirstPin} style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
                    New Security PIN (4-6 digits) *
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="e.g. 1234"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/[^\d]/g, ""))}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "#080b12", border: "1px solid rgba(245,166,35,0.4)", color: "#fff", letterSpacing: "2px", fontWeight: "bold" }}
                    />
                  </label>

                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
                    Confirm Security PIN *
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="Re-enter PIN"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^\d]/g, ""))}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "#080b12", border: "1px solid rgba(245,166,35,0.4)", color: "#fff", letterSpacing: "2px", fontWeight: "bold" }}
                    />
                  </label>

                  {pinModalError && (
                    <p style={{ color: "#f87171", fontSize: "0.78rem", margin: "2px 0 0" }}>
                      {pinModalError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pinSaving}
                    className="arena-cta-btn"
                    style={{ marginTop: 8, padding: "12px", fontSize: "0.9rem" }}
                  >
                    {pinSaving ? "Saving Security PIN..." : "🔒 Save & Activate PIN"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Change PIN Modal */}
          {showChangePinModal && authenticatedUser && (
            <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.85)", zIndex: 99999 }}>
              <div className="modal-content" style={{ maxWidth: 350, padding: 24, textAlign: "center", background: "#121723", border: "1px solid rgba(245, 166, 35, 0.4)", borderRadius: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ color: "#fbbf24", margin: 0, fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🔒</span> Security PIN Settings
                  </h2>
                  <button
                    onClick={() => setShowChangePinModal(false)}
                    style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleChangePin} style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
                    Current Security PIN (leave empty if not set)
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="Current PIN"
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value.replace(/[^\d]/g, ""))}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "#080b12", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", letterSpacing: "2px", fontWeight: "bold" }}
                    />
                  </label>

                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
                    New Security PIN (4-6 digits) *
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="New PIN (e.g. 1234)"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/[^\d]/g, ""))}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "#080b12", border: "1px solid rgba(245,166,35,0.4)", color: "#fff", letterSpacing: "2px", fontWeight: "bold" }}
                    />
                  </label>

                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
                    Confirm New Security PIN *
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="Re-enter New PIN"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^\d]/g, ""))}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "#080b12", border: "1px solid rgba(245,166,35,0.4)", color: "#fff", letterSpacing: "2px", fontWeight: "bold" }}
                    />
                  </label>

                  {pinModalError && (
                    <p style={{ color: "#f87171", fontSize: "0.78rem", margin: "2px 0 0" }}>
                      {pinModalError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pinSaving}
                    className="arena-cta-btn"
                    style={{ marginTop: 8, padding: "12px", fontSize: "0.9rem" }}
                  >
                    {pinSaving ? "Updating PIN..." : "🔑 Update Security PIN"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Awesome Custom Notice / Alert Modal */}
          {noticeModal && noticeModal.isOpen && (
            <div 
              className="modal-overlay" 
              style={{ 
                zIndex: 999999, 
                background: "rgba(7, 9, 18, 0.85)", 
                backdropFilter: "blur(14px)", 
                WebkitBackdropFilter: "blur(14px)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                padding: "20px"
              }}
              onClick={() => setNoticeModal(null)}
            >
              <div 
                className="modal-content" 
                style={{ 
                  maxWidth: 360, 
                  width: "100%",
                  padding: "28px 24px", 
                  textAlign: "center", 
                  background: "linear-gradient(145deg, rgba(26, 31, 53, 0.98) 0%, rgba(14, 18, 30, 0.98) 100%)", 
                  border: noticeModal.type === "error" 
                    ? "1px solid rgba(239, 68, 68, 0.45)" 
                    : noticeModal.type === "warning" 
                    ? "1px solid rgba(245, 158, 11, 0.45)" 
                    : "1px solid rgba(16, 185, 129, 0.45)", 
                  borderRadius: 22,
                  boxShadow: noticeModal.type === "error"
                    ? "0 20px 50px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.15)"
                    : noticeModal.type === "warning"
                    ? "0 20px 50px rgba(245, 158, 11, 0.3), 0 0 20px rgba(245, 158, 11, 0.15)"
                    : "0 20px 50px rgba(16, 185, 129, 0.3), 0 0 20px rgba(16, 185, 129, 0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  borderRadius: "50%", 
                  margin: "0 auto 16px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: "2.2rem",
                  background: noticeModal.type === "error"
                    ? "rgba(239, 68, 68, 0.15)"
                    : noticeModal.type === "warning"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(16, 185, 129, 0.15)",
                  border: noticeModal.type === "error"
                    ? "1px solid rgba(239, 68, 68, 0.35)"
                    : noticeModal.type === "warning"
                    ? "1px solid rgba(245, 158, 11, 0.35)"
                    : "1px solid rgba(16, 185, 129, 0.35)",
                  boxShadow: "inset 0 0 12px rgba(255,255,255,0.05)"
                }}>
                  {noticeModal.icon}
                </div>
                <h3 style={{ 
                  color: noticeModal.type === "error" ? "#fca5a5" : noticeModal.type === "warning" ? "#fbbf24" : "#6ee7b7", 
                  margin: "0 0 10px", 
                  fontSize: "1.2rem", 
                  fontWeight: 800,
                  letterSpacing: "-0.01em"
                }}>
                  {noticeModal.title}
                </h3>
                <p style={{ 
                  color: "rgba(255, 255, 255, 0.85)", 
                  fontSize: "0.86rem", 
                  marginBottom: 22, 
                  lineHeight: 1.5,
                  wordBreak: "break-word"
                }}>
                  {noticeModal.message}
                </p>

                <button
                  onClick={() => setNoticeModal(null)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 14,
                    fontWeight: 800,
                    fontSize: "0.94rem",
                    cursor: "pointer",
                    border: "none",
                    color: noticeModal.type === "error" ? "#ffffff" : "#100b02",
                    background: noticeModal.type === "error"
                      ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                      : noticeModal.type === "warning"
                      ? "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)"
                      : "linear-gradient(135deg, #34d399 0%, #059669 100%)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                    transition: "transform 0.15s ease, filter 0.15s ease",
                  }}
                >
                  Understood
                </button>
              </div>
            </div>
          )}

          {/* ── QR Zoom Modal for Easy Scanning ── */}
          {showQrZoomModal && qrPass && (
            <div
              onClick={() => setShowQrZoomModal(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: "rgba(0, 0, 0, 0.88)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                animation: "fadeIn 0.2s ease"
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "linear-gradient(135deg, rgba(24, 22, 38, 0.98) 0%, rgba(14, 14, 24, 0.98) 100%)",
                  border: "1px solid rgba(245, 166, 35, 0.5)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(245, 166, 35, 0.25)",
                  borderRadius: "24px",
                  padding: "24px 20px",
                  maxWidth: "340px",
                  width: "100%",
                  textAlign: "center",
                  position: "relative"
                }}
              >
                <button
                  onClick={() => setShowQrZoomModal(false)}
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "var(--text-muted)",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>

                <div style={{
                  display: "inline-block",
                  background: "rgba(245, 166, 35, 0.15)",
                  border: "1px solid rgba(245, 166, 35, 0.35)",
                  color: "var(--gold-light)",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: "20px",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  Official Ticket Pass
                </div>

                <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 900, margin: "0 0 2px" }}>
                  {qrPass.fullName}
                </h3>
                <p style={{ color: "#fbbf24", fontWeight: 800, fontSize: "0.95rem", margin: "0 0 16px", letterSpacing: "1px" }}>
                  {qrPass.passCode}
                </p>

                {/* High-Contrast Crisp Large QR code */}
                <div style={{
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "18px",
                  display: "inline-block",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
                }}>
                  <img
                    src={qrPass.qrDataUrl}
                    alt={`QR code for ${qrPass.fullName}`}
                    style={{
                      width: "220px",
                      height: "220px",
                      display: "block",
                      imageRendering: "pixelated"
                    }}
                  />
                </div>

                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "16px", marginBottom: "16px", lineHeight: 1.4 }}>
                  Present this enlarged QR code to the <strong>Gate Staff</strong> or <strong>Sponsor Booths</strong> for instant scanning.
                </p>

                <button
                  onClick={() => setShowQrZoomModal(false)}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)",
                    color: "#100b02",
                    border: "none",
                    borderRadius: "12px",
                    padding: "12px",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(245, 166, 35, 0.35)"
                  }}
                >
                  Done Scanning
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <InstallPrompt />
    </main>
    </>
  );
}
