"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ZealyIntroAnimation from "./zealy-intro-animation";
import InstallPrompt from "./install-prompt";
import FeedbackTicketModal from "./feedback-ticket-modal";
import { createClient } from "../utils/supabase/client";

interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  status: "Live" | "Soon" | "Locked" | "Done" | "Pending Verification" | "Approved" | "Rejected";
  category: "onboarding" | "social" | "daily" | "quiz" | "atfx" | "kol" | "influencer" | string;
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
  created_at?: string;
  depends_on_quest_id?: string;
}

export interface MilestoneTier {
  id?: number | string;
  name: string;
  xp: number;
  icon: string;
  color: string;
  sort_order?: number;
}

const initialMilestones: MilestoneTier[] = [
  { name: "Rookie Quester", xp: 500, icon: "🥉", color: "#cd7f32", sort_order: 1 },
  { name: "Explorer", xp: 1200, icon: "🥈", color: "#94a3b8", sort_order: 2 },
  { name: "Challenger", xp: 2500, icon: "⚔️", color: "#34d399", sort_order: 3 },
  { name: "Master Quester", xp: 5000, icon: "🥇", color: "#ffd700", sort_order: 4 },
  { name: "Diamond Hero", xp: 10000, icon: "💎", color: "#38bdf8", sort_order: 5 },
  { name: "Fiesta Legend", xp: 20000, icon: "👑", color: "#c084fc", sort_order: 6 },
  { name: "Grandmaster", xp: 35000, icon: "⚡", color: "#fbbf24", sort_order: 7 },
  { name: "Mythic Sovereign", xp: 50000, icon: "🌌", color: "#f472b6", sort_order: 8 },
];


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
    status: "Live",
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
    id: "add-alias",
    title: "Add an Alias Name",
    description: "Personalize your identity by creating an alias name for your profile. Once you add an alias, you become eligible to claim 50 XP.",
    xp: 50,
    status: "Live",
    category: "onboarding"
  },
  {
    id: "referral-quest",
    title: "Referral Quest: Invite Friends",
    description: "Invite your friends to register for BlockQuest Fiesta PH using your unique referral link. Earn +100 XP instantly for every friend who registers!",
    xp: 100,
    status: "Live",
    category: "social",
    actionLabel: "Share Referral Link",
    actionUrl: "/zealy"
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
    title: "Peryahan Color Wheel of Luck",
    description: "Paikutin ang roleta sa Peryahan once daily! Subukan ang iyong swerte: baka maka-Jackpot o baka ma-Bokya! 🎪🎲",
    xp: 50,
    status: "Live",
    category: "daily"
  }
];

export interface WheelSegment {
  xp: number;
  label: string;
  color: string;
  textColor?: string;
  weight: number; // probability weight
  tier: "Bokya" | "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Jackpot";
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { xp: 0, label: "BOKYA", color: "#16a34a", textColor: "#ffffff", weight: 25, tier: "Bokya" },
  { xp: 5, label: "5", color: "#eab308", textColor: "#1e1b4b", weight: 22, tier: "Common" },
  { xp: 10, label: "10", color: "#dc2626", textColor: "#ffffff", weight: 18, tier: "Uncommon" },
  { xp: 20, label: "20", color: "#ea580c", textColor: "#ffffff", weight: 12, tier: "Rare" },
  { xp: 5, label: "5", color: "#0284c7", textColor: "#ffffff", weight: 10, tier: "Common" },
  { xp: 0, label: "BOKYA", color: "#dc2626", textColor: "#ffffff", weight: 5, tier: "Bokya" },
  { xp: 30, label: "30", color: "#16a34a", textColor: "#ffffff", weight: 4.5, tier: "Epic" },
  { xp: 50, label: "50", color: "#ea580c", textColor: "#ffffff", weight: 2, tier: "Legendary" },
  { xp: 10, label: "10", color: "#0284c7", textColor: "#ffffff", weight: 1, tier: "Uncommon" },
  { xp: 100, label: "100", color: "#eab308", textColor: "#1e1b4b", weight: 0.5, tier: "Jackpot" },
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

function getDefaultQuestStatus(
  q: { id?: string; status?: string; publish_at?: string },
  isCheckedIn: boolean = false
): "Live" | "Soon" | "Locked" {
  if (q.id === "checkin") return "Live";
  if (q.publish_at) {
    const publishTime = new Date(q.publish_at).getTime();
    if (publishTime > Date.now()) return "Soon";
    if (q.status === "Soon") return "Live";
  }
  return (q.status as "Live" | "Soon" | "Locked") || "Live";
}

export default function ZealyMobileApp() {
  const [mounted, setMounted] = React.useState(false);
  const [activeTab, setActiveTab] = useState<"quests" | "leaderboard" | "peryahan" | "info" | "profile">("quests");
  const [quests, setQuests] = useState<Quest[]>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("bq_user");
      const userEmail = savedUser ? JSON.parse(savedUser)?.email : null;
      const questsKey = userEmail ? `bq_quests_${userEmail}` : "bq_quests";
      const saved = localStorage.getItem(questsKey);
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
      const savedUser = localStorage.getItem("bq_user");
      const userEmail = savedUser ? JSON.parse(savedUser)?.email : null;
      const xpKey = userEmail ? `bq_xp_${userEmail}` : "bq_xp";
      const saved = localStorage.getItem(xpKey);
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
  const [milestones, setMilestones] = useState<MilestoneTier[]>(initialMilestones);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [userMessageInput, setUserMessageInput] = useState("");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [passcodeAnswer, setPasscodeAnswer] = useState("");
  const [telegramUsernameInput, setTelegramUsernameInput] = useState("");
  const [visitedActions, setVisitedActions] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("bq_user");
      const userEmail = savedUser ? JSON.parse(savedUser)?.email : null;
      const visitedKey = userEmail ? `bq_visited_${userEmail}` : "bq_visited";
      const saved = localStorage.getItem(visitedKey);
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackModalInitialMode, setFeedbackModalInitialMode] = useState<"create" | "status">("create");

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

  // Alias name states
  const [userAlias, setUserAlias] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("bq_user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed?.aliasName) return parsed.aliasName;
        } catch {}
      }
      return localStorage.getItem("bq_alias") || null;
    }
    return null;
  });
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [aliasModalError, setAliasModalError] = useState("");
  const [aliasSaving, setAliasSaving] = useState(false);

  // Daily Wheel of Luck State & Audio
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelPrizeResult, setWheelPrizeResult] = useState<{ xp: number; label: string; color: string; tier: string } | null>(null);
  const [wheelClaimedToday, setWheelClaimedToday] = useState(false);
  const [showJackpotFireworks, setShowJackpotFireworks] = useState(false);
  const wheelAudioCtxRef = React.useRef<AudioContext | null>(null);

  // Play realistic mechanical flapper click/tick during wheel spin
  const playWheelTick = React.useCallback((volume = 0.25, freq = 600) => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!wheelAudioCtxRef.current) {
        wheelAudioCtxRef.current = new AudioCtx();
      }
      const ctx = wheelAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.035);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.036);
    } catch {}
  }, []);

  // Play celebration fanfare when winning XP or playful bonk for Bokya
  const playWheelFinishSound = React.useCallback((isBokya: boolean, isJackpot = false) => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!wheelAudioCtxRef.current) {
        wheelAudioCtxRef.current = new AudioCtx();
      }
      const ctx = wheelAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const t = ctx.currentTime;

      if (isBokya) {
        // Playful sad trumpet / slide for Bokya (0 XP)
        const notes = [330, 311, 293, 277];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startT = t + idx * 0.16;
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, startT);
          osc.frequency.linearRampToValueAtTime(freq - 15, startT + 0.18);
          gain.gain.setValueAtTime(0.18, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startT);
          osc.stop(startT + 0.22);
        });
      } else if (isJackpot) {
        // Grand Royal Jackpot Fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]; // C5, E5, G5, C6, E6, G6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startT = t + idx * 0.1;
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, startT);
          gain.gain.setValueAtTime(0.35, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startT);
          osc.stop(startT + 0.65);
        });
      } else {
        // Upbeat victory fiesta chime
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startT = t + idx * 0.12;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, startT);
          gain.gain.setValueAtTime(0.25, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startT);
          osc.stop(startT + 0.48);
        });
      }
    } catch {}
  }, []);
  const [claimedQuestIds, setClaimedQuestIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("bq_user");
      const userEmail = savedUser ? JSON.parse(savedUser)?.email : null;
      const claimedKey = userEmail ? `bq_claimed_${userEmail}` : "bq_claimed";
      const saved = localStorage.getItem(claimedKey);
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [isGateCheckedIn, setIsGateCheckedIn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("bq_user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed.isCheckedIn || parsed.checked_in) return true;
        } catch {}
      }
      return localStorage.getItem("bq_gate_checkin") === "true";
    }
    return false;
  });
  const [userPromoCode, setUserPromoCode] = useState<string | null>(null);
  const [userReferralCount, setUserReferralCount] = useState<number>(0);

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
    setUserPromoCode(null);
    setUserReferralCount(0);
    setTicketEmail("");
    setTicketMobileNum("");
    setTicketCountryCode("+63");
    setTicketError("");
    setTicketPinCode("");
    setShowPinInput(false);
    setUserXp(0);
    setUserRank(12);
    setUserAlias(null);
    setQuests(initialQuests);
    setActiveTab("quests");

    if (typeof window !== "undefined") {
      const email = authenticatedUser?.email;
      localStorage.removeItem("bq_user");
      localStorage.removeItem("bq_qr");
      localStorage.removeItem("bq_alias");
      localStorage.removeItem("bq_xp");
      localStorage.removeItem("bq_rank");
      localStorage.removeItem("bq_quests");
      localStorage.removeItem("bq_visited");
      localStorage.removeItem("bq_claimed");
      if (email) {
        localStorage.removeItem(`bq_alias_${email}`);
        localStorage.removeItem(`bq_xp_${email}`);
        localStorage.removeItem(`bq_rank_${email}`);
        localStorage.removeItem(`bq_quests_${email}`);
        localStorage.removeItem(`bq_visited_${email}`);
        localStorage.removeItem(`bq_claimed_${email}`);
      }
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
    const email = authenticatedUser?.email;
    const key = email ? `bq_xp_${email}` : "bq_xp";
    localStorage.setItem(key, userXp.toString());
  }, [userXp, mounted, authenticatedUser]);

  React.useEffect(() => {
    if (!mounted) return;
    const email = authenticatedUser?.email;
    const key = email ? `bq_rank_${email}` : "bq_rank";
    localStorage.setItem(key, userRank.toString());
  }, [userRank, mounted, authenticatedUser]);

  React.useEffect(() => {
    if (!mounted) return;
    const email = authenticatedUser?.email;
    const key = email ? `bq_quests_${email}` : "bq_quests";
    localStorage.setItem(key, JSON.stringify(quests));
  }, [quests, mounted, authenticatedUser]);

  React.useEffect(() => {
    if (!mounted) return;
    const email = authenticatedUser?.email;
    const key = email ? `bq_visited_${email}` : "bq_visited";
    localStorage.setItem(key, JSON.stringify(visitedActions));
  }, [visitedActions, mounted, authenticatedUser]);

  React.useEffect(() => {
    if (!mounted) return;
    const email = authenticatedUser?.email;
    const key = email ? `bq_claimed_${email}` : "bq_claimed";
    localStorage.setItem(key, JSON.stringify(claimedQuestIds));
  }, [claimedQuestIds, mounted, authenticatedUser]);

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

  // Real-time Attendee Online Presence tracking
  React.useEffect(() => {
    if (!mounted) return;
    try {
      const supabase = createClient();
      const userIdentifier = authenticatedUser?.email || qrPass?.email || "guest-" + Math.random().toString(36).substring(2, 9);
      const userName = authenticatedUser?.full_name || qrPass?.name || userAlias || "Quester";

      const channel = supabase.channel("online_attendees", {
        config: { presence: { key: userIdentifier } },
      });

      channel
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              user_id: userIdentifier,
              name: userName,
              online_at: new Date().toISOString(),
            });
          }
        });

      return () => {
        channel.unsubscribe();
      };
    } catch {
      // Gracefully ignore if offline or connection fails
    }
  }, [mounted, authenticatedUser?.email, qrPass?.email, userAlias]);


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
  const previousQuestIdsRef = React.useRef<Set<string>>(new Set());

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
        if (previousQuestsCountRef.current !== null) {
          const prevIds = previousQuestIdsRef.current;
          const newlyAdded = mappedQuests.filter((q) => !prevIds.has(q.id));
          if (newlyAdded.length > 0) {
            // Pick the quest with the latest creation or publish date
            const sortedByLatest = [...newlyAdded].sort((a, b) => {
              const timeA = new Date(a.created_at || a.publish_at || 0).getTime();
              const timeB = new Date(b.created_at || b.publish_at || 0).getTime();
              return timeB - timeA;
            });
            const latestQuest = sortedByLatest[0];
            setNewQuestAlert({ count: newlyAdded.length, questTitle: latestQuest.title });
          }
        }
        previousQuestsCountRef.current = mappedQuests.length;
        previousQuestIdsRef.current = new Set(mappedQuests.map((q) => q.id));

        // Preserve status only if the user is authenticated and has status or active verification
        setQuests((prevQuests) => {
          // Merge API quests with initial built-in quests so essential quests like daily-claim aren't lost if missing in DB
          const apiIds = new Set(mappedQuests.map((q) => q.id));
          const combinedQuests = [...mappedQuests, ...initialQuests.filter((iq) => !apiIds.has(iq.id))];

          return combinedQuests.map((newQ) => {
            const existing = prevQuests.find((p) => p.id === newQ.id);
            if (newQ.id === "checkin") {
              if (existing?.status === "Done") return { ...newQ, status: "Done", completedAt: (existing as any).completedAt };
              return { ...newQ, status: "Live" };
            }
            if (
              existing &&
              (existing.status === "Done" ||
                existing.status === "Pending Verification" ||
                existing.status === "Approved" ||
                existing.status === "Rejected")
            ) {
              return { ...newQ, status: existing.status, completedAt: (existing as any).completedAt };
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
    const email = authenticatedUser?.email || ticketEmail || qrPass?.email;
    if (!email) {
      setUserVerifications([]);
      return;
    }
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

  const fetchMilestones = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/milestones");
      const json = await safeJson(res);
      if (res.ok && Array.isArray(json.milestones) && json.milestones.length > 0) {
        setMilestones(json.milestones);
      }
    } catch {
      // ignore, keeps fallback
    }
  }, []);

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
    // Only sync if the user is genuinely authenticated (not while typing in a login input)
    const email = authenticatedUser?.email || qrPass?.email;
    if (!email) return;

    try {
      const res = await fetch(`/api/user/sync?email=${encodeURIComponent(email)}`);
      const json = await safeJson(res);
      if (!res.ok) return;

      const { totalXp, completedQuests, completedQuestDetails, verifications, isCheckedIn, promoCode, aliasName, referralCount, ticketCode } = json;

      if (typeof referralCount === "number") {
        setUserReferralCount(referralCount);
      }

      if (ticketCode) {
        setAuthenticatedUser((prev: any) => (prev ? { ...prev, ticket_code: ticketCode } : prev));
      }

      if (typeof aliasName === "string" && aliasName.trim()) {
        setUserAlias(aliasName.trim());
        if (typeof window !== "undefined") {
          localStorage.setItem("bq_alias", aliasName.trim());
          localStorage.setItem(`bq_alias_${email}`, aliasName.trim());
        }
      }

      if (typeof promoCode === "string" && promoCode.trim()) {
        setUserPromoCode(promoCode.trim());
      } else {
        setUserPromoCode(null);
      }

      if (typeof isCheckedIn === "boolean") {
        setIsGateCheckedIn(isCheckedIn);
        if (typeof window !== "undefined") {
          localStorage.setItem("bq_gate_checkin", String(isCheckedIn));
        }
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
              status: isDone ? "Done" : (promoCode ? "Live" : "Locked"),
              completedAt: isDone ? (compMap.get(q.id) || (q as any).completedAt) : undefined,
            };
          }
          if (q.id === "daily-claim") {
            const todayStr = new Date().toISOString().slice(0, 10);
            const legacyCompDate = (compMap.get("daily-claim") || "").slice(0, 10);
            const isDoneToday = compMap.has(`daily-claim-${todayStr}`) || (compMap.has("daily-claim") && legacyCompDate === todayStr);
            // If already claimed today:
            if (isDoneToday) {
              const compTime = compMap.get(`daily-claim-${todayStr}`) || compMap.get("daily-claim") || new Date().toISOString();
              return { ...q, status: "Done", completedAt: compTime };
            }
            // Otherwise, reset to Live for today's spin!
            return { ...q, status: "Live", completedAt: undefined };
          }
          if (compMap.has(q.id)) {
            return { ...q, status: "Done", completedAt: compMap.get(q.id) || (q as any).completedAt };
          }
          if (q.id === "checkin") {
            return { ...q, status: "Live", completedAt: undefined };
          }
          const vData = verifMap.get(q.id);
          if (vData?.status === "Pending") {
            return { ...q, status: "Pending Verification", completedAt: undefined };
          }
          if (vData?.status === "Approved") {
            return { ...q, status: "Done", completedAt: vData.createdAt || (q as any).completedAt };
          }
          if (vData?.status === "Rejected") {
            return { ...q, status: "Rejected", completedAt: undefined };
          }
          // Quest is neither completed nor verified by this user; restore its proper default status
          const cleanStatus = getDefaultQuestStatus(q, isCheckedIn);
          return { ...q, status: cleanStatus, completedAt: undefined };
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
    fetchMilestones();
    syncUserData();
  }, [fetchUserVerifications, fetchLeaderboard, fetchMilestones, syncUserData, activeTab]);

  // Poll for new quests, verifications, milestones & user state sync when tab is visible
  useEffect(() => {
    loadApiQuests();
    fetchUserVerifications();
    fetchLeaderboard();
    fetchMilestones();
    syncUserData();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return; // Pause polling when tab is in background
      loadApiQuests();
      fetchUserVerifications();
      fetchLeaderboard();
      fetchMilestones();
      syncUserData();
    }, 20000); // 20-second refresh interval keeps real-time freshness while preventing high Supabase CPU
    return () => clearInterval(interval);
  }, [loadApiQuests, fetchUserVerifications, fetchLeaderboard, fetchMilestones, syncUserData]);

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

    if (quest.id === "daily-claim") {
      const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
      const todayStr = new Date().toISOString().slice(0, 10);
      const isDone = quest.status === "Done" || (email && typeof window !== "undefined" && !!localStorage.getItem(`bq_daily_wheel_${email}_${todayStr}`));
      setWheelClaimedToday(isDone);
      setWheelPrizeResult(null);
      setActiveTab("peryahan");
      return;
    }

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

    const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
    if (!email || email === "quester@blockquest.ph" || email === "user@blockquest.ph") {
      showNotice(
        "Please log in with your registered event ticket or email before submitting quest proofs!",
        "warning",
        "Registration Required",
        "🎫"
      );
      return;
    }

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
          user_email: email,
          ticket_code: qrPass?.passCode || "BQF-REGISTERED",
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

  const handleSpinDailyWheel = async () => {
    if (wheelSpinning || wheelClaimedToday) return;

    // Check if user is authenticated/has ticket
    const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
    if (!email) {
      showNotice("Please link your event ticket first to claim daily spin points!", "warning", "Ticket Pass Required", "🎟️");
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const storageKey = `bq_daily_wheel_${email}_${todayStr}`;
    if (typeof window !== "undefined" && localStorage.getItem(storageKey)) {
      showNotice("You have already used your 1 daily spin for today! Come back tomorrow at 00:00 UTC.", "info", "Daily Limit Reached", "⏳");
      setWheelClaimedToday(true);
      return;
    }

    setWheelSpinning(true);
    setWheelPrizeResult(null);
    setClaiming(true);

    try {
      // 1. Request the server to perform the spin securely.
      // The server rolls weighted probabilities and locks the claim so it CANNOT be spoofed or re-spun.
      const res = await fetch("/api/user/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quest_id: "daily-claim",
          user_email: email,
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        throw new Error(json.error || "Failed to record daily spin reward.");
      }

      // Identify server-chosen segment index (fallback to segment matching awarded XP if index not returned)
      let selectedSegmentIndex = 0;
      if (typeof json.segment_index === "number" && json.segment_index >= 0 && json.segment_index < WHEEL_SEGMENTS.length) {
        selectedSegmentIndex = json.segment_index;
      } else {
        const foundIdx = WHEEL_SEGMENTS.findIndex((s) => s.xp === json.xp_awarded);
        if (foundIdx !== -1) selectedSegmentIndex = foundIdx;
      }

      const winningSegment = WHEEL_SEGMENTS[selectedSegmentIndex];
      const segmentAngle = 360 / WHEEL_SEGMENTS.length; // 36 deg each (10 segments)
      // The diamond flapper stopper is at top center (0° / 360°)
      // Slices are drawn starting from -90° (top center)
      const segCenterAngle = selectedSegmentIndex * segmentAngle + segmentAngle / 2;
      const targetAngle = (360 - segCenterAngle) % 360;
      // 9 to 11 full rotations for an exciting, prolonged suspenseful spin
      const totalSpins = 9 + Math.floor(Math.random() * 3);
      const currentModulo = wheelRotation % 360;
      const diff = (targetAngle - currentModulo + 360) % 360;
      const finalDegree = wheelRotation + (totalSpins * 360) + diff;

      // 2. Animate wheel rotation with 8.5s realistic deceleration
      setWheelRotation(finalDegree);

      // 3. Audio: realistic mechanical flapper clicking sound that decelerates over time
      const totalDurationMs = 8500;
      const totalTicks = 85; // clicks throughout the spin
      for (let i = 0; i < totalTicks; i++) {
        // Power curve (t^2.6) starts rapid (burst of clicks) and gradually spaces out as wheel slows down
        const progress = i / totalTicks;
        const tickTime = Math.pow(progress, 2.6) * totalDurationMs;
        const clickPitch = 640 - progress * 140; // slightly deeper click as speed slows
        const clickVol = Math.max(0.08, 0.28 * (1 - progress * 0.4));
        setTimeout(() => {
          playWheelTick(clickVol, clickPitch);
        }, tickTime);
      }

      // 4. Reveal prize and play victory/bokya sound after rotation animation completes
      setTimeout(() => {
        setWheelPrizeResult(winningSegment);
        setWheelSpinning(false);
        setClaiming(false);

        const isJackpotWin = winningSegment.tier === "Jackpot" || winningSegment.xp >= 100;

        // Play outcome sound (fanfare or bokya slide)
        playWheelFinishSound(winningSegment.xp === 0, isJackpotWin);

        // Mark local storage & component state as claimed today
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify({ xp: winningSegment.xp, date: todayStr }));
        }
        setWheelClaimedToday(true);
        if (typeof json.total_xp === "number") {
          setUserXp(json.total_xp);
        } else {
          setUserXp((prev) => prev + winningSegment.xp);
        }
        setQuests((prevQuests) =>
          prevQuests.map((q) => (q.id === "daily-claim" ? { ...q, status: "Done", completedAt: new Date().toISOString() } : q))
        );

        if (winningSegment.xp === 0) {
          showNotice(
            "Aray kupo! Bokya! Better luck next time! Bawi na lang bukas sa Peryahan!",
            "info",
            "🎪 Bokya! (0 XP)",
            "🃏"
          );
        } else if (isJackpotWin) {
          // 🎆 Show grand fireworks celebration FIRST, then reveal congratulations modal
          setShowJackpotFireworks(true);
          setTimeout(() => {
            setShowJackpotFireworks(false);
            showNotice(
              `🎊 JACKPOT WINNER! 🎊\n\nIncredible luck! You hit the MAX PRIZE ${winningSegment.label} (${winningSegment.tier} Tier) from the Peryahan Roleta! +100 XP has been credited!`,
              "success",
              "🌟 GRAND JACKPOT WINNER!",
              "👑"
            );
          }, 3200);
        } else {
          showNotice(
            `Panalo! You hit ${winningSegment.label} (${winningSegment.tier} Tier) from the Peryahan Wheel!`,
            "success",
            "🎉 Peryahan Reward Claimed!",
            winningSegment.tier === "Legendary" ? "👑" : "🎯"
          );
        }
        fetchLeaderboard();
        syncUserData();
        fetchUserVerifications();
      }, totalDurationMs + 100);
    } catch (err: any) {
      setWheelSpinning(false);
      setClaiming(false);
      showNotice(err.message || "Failed to claim spin XP reward.", "error", "Daily Spin Notice", "⚠️");
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
      const aliasFromLogin = loginResult.aliasName || null;
      if (typeof loginResult.referralCount === "number") {
        setUserReferralCount(loginResult.referralCount);
      }
      setAuthenticatedUser({
        fullName: loginResult.fullName,
        aliasName: aliasFromLogin,
        email: loginResult.email,
        promoCode: loginResult.promoCode,
        ticket_code: loginResult.ticketCode || qrResult.passCode,
        referralCount: loginResult.referralCount || 0,
      });
      setUserAlias(aliasFromLogin);
      if (typeof window !== "undefined") {
        if (aliasFromLogin) {
          localStorage.setItem("bq_alias", aliasFromLogin);
          localStorage.setItem(`bq_alias_${loginResult.email}`, aliasFromLogin);
        } else {
          localStorage.removeItem("bq_alias");
          localStorage.removeItem(`bq_alias_${loginResult.email}`);
        }
      }
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
      setUserPromoCode(promoCode || null);

      if (typeof loginResult.isCheckedIn === "boolean") {
        setIsGateCheckedIn(loginResult.isCheckedIn);
        if (typeof window !== "undefined") {
          localStorage.setItem("bq_gate_checkin", String(loginResult.isCheckedIn));
        }
      }

      // If switching accounts or logging into a new account, restore existing claimed and visited actions from scoped storage
      if (typeof window !== "undefined") {
        const scopedClaimed = localStorage.getItem(`bq_claimed_${loginResult.email}`);
        setClaimedQuestIds(scopedClaimed ? JSON.parse(scopedClaimed) : []);
        const scopedVisited = localStorage.getItem(`bq_visited_${loginResult.email}`);
        setVisitedActions(scopedVisited ? JSON.parse(scopedVisited) : {});
      }

      // Restore existing completions and XP from database, ensuring uncompleted quests are clean
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
              status: isDone ? "Done" : (promoCode ? "Live" : "Locked"),
              completedAt: isDone ? (q as any).completedAt : undefined,
            };
          }
          if (completedIds.includes(q.id)) {
            return { ...q, status: "Done" };
          }
          const cleanStatus = getDefaultQuestStatus(q, loginResult.isCheckedIn);
          return { ...q, status: cleanStatus, completedAt: undefined };
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

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    setAliasModalError("");
    const cleanAlias = aliasInput.trim();
    if (!cleanAlias) {
      setAliasModalError("Please enter an alias name.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanAlias)) {
      setAliasModalError("Alias must be 3-20 characters using letters, numbers, underscores, or hyphens.");
      return;
    }

    const email = authenticatedUser?.email || ticketEmail.trim() || qrPass?.email;
    if (!email) {
      setAliasModalError("No active logged-in session found.");
      return;
    }

    setAliasSaving(true);
    try {
      const res = await fetch("/api/user/alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, alias: cleanAlias }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to save alias.");
      }

      const savedAlias = data.alias || cleanAlias;
      setUserAlias(savedAlias);
      if (typeof window !== "undefined") {
        localStorage.setItem("bq_alias", savedAlias);
        localStorage.setItem(`bq_alias_${email}`, savedAlias);
        const savedUserStr = localStorage.getItem("bq_user");
        if (savedUserStr) {
          try {
            const u = JSON.parse(savedUserStr);
            u.aliasName = savedAlias;
            localStorage.setItem("bq_user", JSON.stringify(u));
          } catch {}
        }
      }

      setAuthenticatedUser((prev: any) => (prev ? { ...prev, aliasName: savedAlias } : prev));
      setShowAliasModal(false);
      setAliasInput("");
      // Refresh leaderboard so the new alias is reflected immediately
      fetchLeaderboard();
      showNotice(`Your leaderboard alias is now set to @${savedAlias}! Your real name is hidden.`, "success", "Alias Saved", "🛡️");
    } catch (err: any) {
      setAliasModalError(err.message || "Failed to update alias.");
    } finally {
      setAliasSaving(false);
    }
  };

  // ── Constellation Particle Network for Background ──
  const bgCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const colors = [
      "#a855f7", // Electric Purple
      "#c084fc", // Soft Violet
      "#60a5fa", // Electric Blue
      "#f5a623", // Glowing Amber/Gold
      "#ffffff", // Pure White
    ];

    const particleCount = Math.min(Math.floor((width * height) / 16000), 75);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      color: string;
      alpha: number;
      baseAlpha: number;
      pulseSpeed: number;
      pulseOffset: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const baseRadius = Math.random() * 2.2 + 0.8;
      const baseAlpha = Math.random() * 0.5 + 0.35;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: baseRadius,
        baseRadius,
        color,
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Draw constellation lines & polygon meshes
      const maxDistance = 140;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alphaFactor = (1 - dist / maxDistance);
            const lineAlpha = 0.22 * alphaFactor;

            // Gradient line linking nearby floating nodes
            const grad = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y
            );
            grad.addColorStop(0, particles[i].color);
            grad.addColorStop(1, particles[j].color);

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = grad;
            ctx.globalAlpha = lineAlpha;
            ctx.lineWidth = 0.85;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Optional subtle polygon triangular mesh fill for tightly clustered triplets
            for (let k = j + 1; k < particles.length; k++) {
              const dx2 = particles[j].x - particles[k].x;
              const dy2 = particles[j].y - particles[k].y;
              const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

              const dx3 = particles[i].x - particles[k].x;
              const dy3 = particles[i].y - particles[k].y;
              const dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);

              if (dist2 < maxDistance * 0.75 && dist3 < maxDistance * 0.75) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.lineTo(particles[k].x, particles[k].y);
                ctx.closePath();
                ctx.fillStyle = "rgba(168, 85, 247, 0.025)";
                ctx.fill();
              }
            }
          }
        }
      }

      // Update & draw glowing particles with natural pulsation & smooth boundary wrap
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Smooth boundary wrap
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Natural glowing pulsation
        const pulse = Math.sin(frameCount * p.pulseSpeed + p.pulseOffset);
        p.alpha = Math.max(0.15, p.baseAlpha + pulse * 0.25);
        p.radius = Math.max(0.5, p.baseRadius + pulse * 0.5);

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
        {/* Background Constellation Particle Canvas */}
        <canvas
          ref={bgCanvasRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
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
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxShadow: "0 8px 24px rgba(245, 166, 35, 0.4)",
                cursor: "pointer",
                animation: "slideInDown 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>🔔</span>
                <div style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)", minWidth: 0, flex: 1 }}>
                  <div style={{ color: "#100b02", fontWeight: 900, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    🎉 New Quest Arrived! ({newQuestAlert.count})
                  </div>
                  <div style={{ color: "#2d1c03", fontSize: "0.76rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    "{newQuestAlert.questTitle}"
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{
                  background: "#100b02",
                  color: "#fbbf24",
                  padding: "5px 10px",
                  borderRadius: 10,
                  fontSize: "0.74rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap"
                }}>
                  View →
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewQuestAlert(null);
                  }}
                  style={{
                    background: "rgba(16, 11, 2, 0.2)",
                    border: "none",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#100b02",
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    cursor: "pointer",
                    padding: 0
                  }}
                  aria-label="Dismiss alert"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className={`app-content-scroll app-content-scroll--${activeTab}${wheelSpinning ? " is-spinning-locked" : ""}`}>
            {activeTab !== "profile" && activeTab !== "info" && activeTab !== "peryahan" && (authenticatedUser || qrPass) && (
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
                          <div style={{ marginTop: 8, marginBottom: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(245, 166, 35, 0.08)", border: "1px dashed rgba(245, 166, 35, 0.3)" }}>
                            <p style={{ fontSize: "0.74rem", color: "rgba(245, 166, 35, 0.95)", margin: "0 0 6px", lineHeight: 1.4 }}>
                              💡 <strong>Forgot PIN?</strong> Ask Event Staff at the helpdesk or send a support ticket below:
                            </p>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.72rem" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setFeedbackModalInitialMode("create");
                                  setShowFeedbackModal(true);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "#ffd166",
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                ✍️ Request PIN Help Ticket
                              </button>
                              <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFeedbackModalInitialMode("status");
                                  setShowFeedbackModal(true);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "#38bdf8",
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                🔍 Check Ticket Status & Admin Note
                              </button>
                            </div>
                          </div>
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
                    {/* Notice Banner when user has rejected quests needing retry */}
                    {quests.some((q) => q.status === "Rejected") && (
                      <div
                        style={{
                          background: "linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)",
                          border: "1.5px solid rgba(239, 68, 68, 0.65)",
                          borderRadius: 14,
                          padding: "12px 14px",
                          marginBottom: 12,
                          boxShadow: "0 4px 16px rgba(239, 68, 68, 0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          animation: "retryPulse 2.5s infinite ease-in-out",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: "1.3rem" }}>🚨</span>
                          <div>
                            <div style={{ color: "#fecaca", fontWeight: 900, fontSize: "0.86rem", letterSpacing: "0.02em" }}>
                              {quests.filter((q) => q.status === "Rejected").length} Quest{quests.filter((q) => q.status === "Rejected").length > 1 ? "s" : ""} Need Attention & Retry!
                            </div>
                            <div style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: "0.74rem", marginTop: 2 }}>
                              Check reviewer feedback below to update and resubmit.
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#f87171", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>
                          Fix Now ↓
                        </span>
                      </div>
                    )}

                    {/* Active / In Progress Quests */}
                    <div className="quest-category__title" style={{ marginTop: "2px", marginBottom: "2px", fontSize: "0.72rem" }}>
                      <span>⚡ Active Quests ({quests.filter((q) => q.status !== "Done" && q.id !== "daily-claim").length})</span>
                    </div>

                    {quests
                      .filter((q) => q.status !== "Done" && q.id !== "daily-claim")
                      .sort((a, b) => {
                        // Priority: Rejected (needs retry immediately) & Approved (ready to claim) at top
                        const priorityScore = (status: string) => {
                          if (status === "Rejected") return 0;
                          if (status === "Approved") return 1;
                          if (status === "Live") return 2;
                          if (status === "Pending Verification") return 3;
                          return 4;
                        };
                        const pA = priorityScore(a.status);
                        const pB = priorityScore(b.status);
                        if (pA !== pB) return pA - pB;

                        const orderA = (a as any).sort_order ?? 999;
                        const orderB = (b as any).sort_order ?? 999;
                        if (orderA !== orderB) return orderA - orderB; // ASC sort order
                        const timeA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
                        const timeB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
                        return timeA - timeB; // ASC date order
                      })
                      .map((q) => {
                        const verifForQuest = q.status === "Rejected" ? userVerifications.find((v) => v.quest_id === q.id) : null;
                        return (
                          <div
                            key={q.id}
                            className={`quest-card quest-card--${q.status.toLowerCase().replace(/\s+/g, "-")}`}
                            onClick={() => handleQuestClick(q)}
                            style={
                              q.status === "Approved"
                                ? { border: "1px solid rgba(16, 185, 129, 0.5)", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(20, 20, 30, 0.9) 100%)" }
                                : q.status === "Rejected"
                                  ? undefined // Styled cleanly via .quest-card--rejected in globals.css
                                  : q.status === "Pending Verification"
                                    ? { border: "1px solid rgba(245, 158, 11, 0.4)", background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 30, 0.9) 100%)" }
                                    : undefined
                            }
                          >
                            <div className="quest-card__body">
                              <div className="quest-card__meta">
                                {q.status === "Rejected" && (
                                  <span className="quest-retry-badge">
                                    <span>⚠️ RETRY REQUIRED</span>
                                  </span>
                                )}
                                <span className={`category-badge category-badge--${q.category}`}>
                                  {q.id === "daily-claim" ? "🎪 Peryahan Wheel" : q.category}
                                </span>
                                <span className="xp-badge">
                                  {q.id === "daily-claim" ? "🎲 0-100 XP" : `+${q.xp} XP`}
                                </span>
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

                              {/* Highlight Admin Rejection Reason Directly on Card */}
                              {q.status === "Rejected" && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    background: "rgba(239, 68, 68, 0.16)",
                                    border: "1px dashed rgba(239, 68, 68, 0.45)",
                                    fontSize: "0.74rem",
                                    color: "#fca5a5",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 6,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  <span style={{ flexShrink: 0, marginTop: 1 }}>💬</span>
                                  <div>
                                    <strong style={{ color: "#fecaca" }}>Feedback: </strong>
                                    <span>
                                      {verifForQuest?.rejection_reason
                                        ? `"${verifForQuest.rejection_reason}"`
                                        : "Admin requested a resubmission. Tap here to review requirements and retry."}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="quest-card__footer">
                              {q.status === "Approved" ? (
                                <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.25)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.4)", fontWeight: 800 }}>
                                  🎉 Ready to Claim XP →
                                </span>
                              ) : q.status === "Rejected" ? (
                                <span className="quest-retry-badge">
                                  <span>🔄 Tap to Fix & Retry</span>
                                  <span style={{ fontSize: "0.85rem" }}>→</span>
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
                        );
                      })}

                    {/* Completed Quests Toggle Section (STRICTLY Done ONLY) */}
                    {quests.filter((q) => q.status === "Done" && q.id !== "daily-claim").length > 0 && (
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
                            ✅ Completed Quests ({quests.filter((q) => q.status === "Done" && q.id !== "daily-claim").length})
                          </span>
                          <span style={{ color: "var(--gold-light)", fontWeight: 800, fontSize: "0.85rem" }}>
                            {showCompletedQuests ? "Hide ▴" : "Show ▾"}
                          </span>
                        </button>

                        {showCompletedQuests && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                            {quests
                              .filter((q) => q.status === "Done" && q.id !== "daily-claim")
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
                <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <p className="section-head__eyebrow">Real-time stats</p>
                    <h2>Global Leaderboard</h2>
                  </div>
                  {(authenticatedUser || qrPass) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAliasModalError("");
                        setAliasInput(userAlias || "");
                        setShowAliasModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 10,
                        background: userAlias ? "rgba(245, 166, 35, 0.15)" : "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                        border: "1px solid rgba(245, 166, 35, 0.4)",
                        color: userAlias ? "var(--gold-light)" : "#000",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: userAlias ? "none" : "0 2px 10px rgba(245, 166, 35, 0.3)",
                      }}
                    >
                      <span>🛡️</span>
                      <span>{userAlias ? `@${userAlias}` : "Set Alias Name"}</span>
                      <span style={{ opacity: 0.75, fontSize: "0.68rem" }}>✏️</span>
                    </button>
                  )}
                </div>

                {/* Privacy Badge Banner */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: "1.1rem" }}>🔒</span>
                    <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                      {userAlias ? (
                        <>You are appearing publicly as <strong style={{ color: "var(--gold-light)" }}>@{userAlias}</strong>. Full names remain private.</>
                      ) : (
                        <>Real names are masked on rankings. Set your custom alias name to stand out!</>
                      )}
                    </p>
                  </div>
                  {!(authenticatedUser || qrPass) && (
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      Link ticket to set alias
                    </span>
                  )}
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
                              background: "linear-gradient(135deg, rgba(245, 166, 35, 0.22) 0%, rgba(20, 20, 32, 0.95) 100%)",
                              boxShadow: "0 4px 16px rgba(245, 166, 35, 0.25)",
                              padding: "8px 12px",
                            }
                            : {
                              padding: "8px 12px",
                            }
                        }
                      >
                        <div
                          className="leaderboard-item__rank"
                          style={{
                            width: 30,
                            height: 30,
                            minWidth: 30,
                            fontSize: "0.82rem",
                            ...(isCurrentUser ? { color: "var(--gold-light)", fontWeight: 900, borderColor: "rgba(245, 166, 35, 0.4)" } : {})
                          }}
                        >
                          #{item.rank}
                        </div>
                        <div className="leaderboard-item__info" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: "0.88rem",
                                fontWeight: 800,
                                color: isCurrentUser ? "#fff" : "rgba(255, 255, 255, 0.92)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.name}
                            </span>
                            {isCurrentUser && (
                              <span
                                style={{
                                  fontSize: "0.58rem",
                                  lineHeight: 1,
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  background: "linear-gradient(135deg, #ffd166 0%, #f5a623 100%)",
                                  color: "#0a0a10",
                                  fontWeight: 900,
                                  letterSpacing: "0.06em",
                                  flexShrink: 0,
                                }}
                              >
                                YOU
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: isCurrentUser ? "var(--gold-light)" : "var(--text-secondary)",
                                fontWeight: isCurrentUser ? 700 : 500,
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              {isCurrentUser ? "🌟 Your Rank" : `Rank #${item.rank}`}
                            </span>
                            {item.ticketCode && (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  lineHeight: "1.2",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(245, 166, 35, 0.1)",
                                  border: "1px solid rgba(245, 166, 35, 0.28)",
                                  color: "rgba(245, 166, 35, 0.95)",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  fontWeight: 700,
                                  letterSpacing: "0.02em",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <span>🎟️</span>
                                <span>{item.ticketCode}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 1, flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: "0.88rem",
                              fontWeight: 900,
                              color: isCurrentUser ? "var(--gold-light)" : "#fff",
                              letterSpacing: "-0.01em",
                              lineHeight: 1.1,
                            }}
                          >
                            {item.points} XP
                          </div>
                          <div
                            className="leaderboard-item__change"
                            style={{ fontSize: "0.68rem", lineHeight: 1.1 }}
                          >
                            {item.change}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {activeTab === "peryahan" && (
              <div className="zealy-tab-content zealy-tab-content--peryahan">
                <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 0 }}>
                  <div>
                    <p className="section-head__eyebrow" style={{ marginBottom: 0 }}>Fiesta Carnival Game</p>
                    <h2 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "1.05rem" }}>
                      <span>🎪</span>
                      <span>Peryahan Wheel of Spin</span>
                    </h2>
                  </div>
                  <div style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 8,
                    background: wheelClaimedToday ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.2) 100%)",
                    border: wheelClaimedToday ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(16, 185, 129, 0.5)",
                    color: wheelClaimedToday ? "rgba(255,255,255,0.6)" : "#34d399",
                    display: "flex",
                    alignItems: "center",
                    gap: 5
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: wheelClaimedToday ? "#6b7280" : "#10b981", boxShadow: wheelClaimedToday ? "none" : "0 0 8px #10b981" }} />
                    <span>{wheelClaimedToday ? "Claimed Today" : "1 Free Spin Ready"}</span>
                  </div>
                </div>

                <div className="peryahan-main-card" style={{
                  background: "radial-gradient(ellipse at top, rgba(245, 166, 35, 0.15) 0%, rgba(12, 26, 59, 0.7) 60%, rgba(8, 8, 16, 0.95) 100%)",
                  border: "1.5px solid rgba(250, 204, 21, 0.35)",
                  borderRadius: 18,
                  padding: "10px 10px 12px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden"
                }}>
                  <div style={{ textAlign: "center", maxWidth: 300 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "0.82rem", fontWeight: 800, color: "#fef08a", letterSpacing: "0.02em" }}>
                      🎡 Spin the Festive Peryahan Roleta!
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>
                      Hit the jackpot slice to win up to <strong>100 XP</strong>! Watch out for the Calavera Bokya!
                    </p>
                  </div>

                  {/* Mexican Fiesta Arch Container */}
                  <div style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 320,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}>
                    {/* Fiesta Golden Arch Frame with Navy Outline */}
                    <div style={{
                      position: "relative",
                      width: 290,
                      height: 290,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.6))"
                    }}>
                      {/* Outer Deep Navy Arch Ring */}
                      <div style={{
                        position: "absolute",
                        width: 286,
                        height: 286,
                        borderRadius: "50%",
                        background: "#0c1a3b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        {/* Bold Golden Yellow Rim */}
                        <div style={{
                          position: "absolute",
                          width: 270,
                          height: 270,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
                          border: "3.5px solid #0c1a3b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {/* Inner Red Accent Ring */}
                          <div style={{
                            position: "absolute",
                            width: 248,
                            height: 248,
                            borderRadius: "50%",
                            background: "#dc2626",
                            border: "2.5px solid #0c1a3b",
                            overflow: "hidden"
                          }} />
                        </div>
                      </div>

                      {/* Top Fiery Diamond Pointer Pin (Pointing downward to top slice) */}
                      <div style={{
                        position: "absolute",
                        top: -10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 40,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.7))"
                      }}>
                        {/* Diamond Gem */}
                        <div style={{
                          width: 26,
                          height: 26,
                          background: "linear-gradient(135deg, #fde047 0%, #ea580c 60%, #b91c1c 100%)",
                          border: "2.5px solid #0c1a3b",
                          borderRadius: 5,
                          transform: "rotate(45deg)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <div style={{
                            width: 10,
                            height: 10,
                            background: "#ffffff",
                            borderRadius: 2,
                            opacity: 0.9
                          }} />
                        </div>
                        {/* Pointer Arrow Tip */}
                        <div style={{
                          width: 0,
                          height: 0,
                          borderLeft: "10px solid transparent",
                          borderRight: "10px solid transparent",
                          borderTop: "14px solid #b91c1c",
                          marginTop: -6
                        }} />
                      </div>

                      {/* Ambient Pop-up Carnival Fireworks while viewing / temporary spin */}
                      {!wheelSpinning && !wheelPrizeResult && !wheelClaimedToday && (
                        <div className="wheel-ambient-fireworks-container" aria-hidden="true">
                          {[
                            { top: "6%", left: "4%", color: "#facc15", delay: "0s" },
                            { top: "12%", right: "6%", color: "#38bdf8", delay: "1.1s" },
                            { top: "72%", left: "2%", color: "#ec4899", delay: "1.9s" },
                            { top: "68%", right: "4%", color: "#34d399", delay: "0.6s" },
                            { top: "2%", left: "50%", color: "#f97316", delay: "2.3s" },
                            { top: "84%", left: "48%", color: "#a855f7", delay: "1.5s" },
                          ].map((burst, i) => (
                            <div
                              key={i}
                              className="ambient-firework-burst"
                              style={{
                                top: burst.top,
                                left: (burst as any).left,
                                right: (burst as any).right,
                                color: burst.color,
                                animationDelay: burst.delay,
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Rotating Wheel Disc with Fiesta Graphics */}
                      <div
                        className={`peryahan-wheel-disc ${!wheelSpinning && !wheelPrizeResult && !wheelClaimedToday ? "is-idle-spinning" : ""}`}
                        style={{
                          position: "relative",
                          width: 242,
                          height: 242,
                          borderRadius: "50%",
                          overflow: "hidden",
                          transform: wheelSpinning || wheelPrizeResult || wheelClaimedToday ? `rotate(${wheelRotation}deg)` : undefined,
                          transition: wheelSpinning
                            ? "transform 8.5s cubic-bezier(0.15, 0.95, 0.2, 1)"
                            : "transform 0.4s ease-out",
                          zIndex: 10
                        }}
                      >
                        <svg viewBox="0 0 240 240" width="100%" height="100%">
                          <defs>
                            <filter id="fiestaTextDropDedicated" x="-30%" y="-30%" width="160%" height="160%">
                              <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.9" />
                            </filter>
                          </defs>

                          {WHEEL_SEGMENTS.map((seg, idx) => {
                            const anglePerSeg = 360 / WHEEL_SEGMENTS.length;
                            const startAngle = idx * anglePerSeg - 90;
                            const endAngle = (idx + 1) * anglePerSeg - 90;
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;
                            const x1 = 120 + 120 * Math.cos(startRad);
                            const y1 = 120 + 120 * Math.sin(startRad);
                            const x2 = 120 + 120 * Math.cos(endRad);
                            const y2 = 120 + 120 * Math.sin(endRad);
                            const pathData = `M 120 120 L ${x1} ${y1} A 120 120 0 0 1 ${x2} ${y2} Z`;

                            const midAngle = startAngle + anglePerSeg / 2;
                            const textRad = (midAngle * Math.PI) / 180;

                            const arrowX = 120 + 96 * Math.cos(textRad);
                            const arrowY = 120 + 96 * Math.sin(textRad);

                            const textX = 120 + 72 * Math.cos(textRad);
                            const textY = 120 + 72 * Math.sin(textRad);

                            const pegX = 120 + 38 * Math.cos(startRad);
                            const pegY = 120 + 38 * Math.sin(startRad);

                            const isBokya = seg.tier === "Bokya";

                            return (
                              <g key={idx}>
                                <path
                                  d={pathData}
                                  fill={seg.color}
                                  stroke="#0c1a3b"
                                  strokeWidth="3"
                                />

                                <g transform={`rotate(${midAngle + 90}, ${arrowX}, ${arrowY})`}>
                                  <polyline
                                    points={`${arrowX - 8},${arrowY - 4} ${arrowX},${arrowY + 4} ${arrowX + 8},${arrowY - 4}`}
                                    fill="none"
                                    stroke={isBokya ? "#fde047" : "#ffffff"}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <circle
                                    cx={arrowX}
                                    cy={arrowY - 7}
                                    r="2.5"
                                    fill={isBokya ? "#fde047" : "#ffffff"}
                                  />
                                </g>

                                {isBokya ? (
                                  <g transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}>
                                    <circle cx={textX} cy={textY - 3} r="13" fill="#facc15" stroke="#0c1a3b" strokeWidth="2.5" />
                                    <circle cx={textX - 4.5} cy={textY - 5} r="2.8" fill="#dc2626" />
                                    <circle cx={textX + 4.5} cy={textY - 5} r="2.8" fill="#dc2626" />
                                    <polygon points={`${textX},${textY - 2} ${textX - 2},${textY + 1} ${textX + 2},${textY + 1}`} fill="#0c1a3b" />
                                    <rect x={textX - 5.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                    <rect x={textX - 1.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                    <rect x={textX + 2.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                    <text
                                      x={textX}
                                      y={textY + 14}
                                      fill="#ffffff"
                                      stroke="#0c1a3b"
                                      strokeWidth="3"
                                      strokeLinejoin="round"
                                      paintOrder="stroke fill"
                                      fontSize="8.5"
                                      fontWeight="900"
                                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Impact, sans-serif"
                                      letterSpacing="0.08em"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                    >
                                      BOKYA
                                    </text>
                                  </g>
                                ) : (
                                  <g transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}>
                                    <text
                                      x={textX}
                                      y={textY}
                                      fill="#ffffff"
                                      stroke="#0c1a3b"
                                      strokeWidth="3.5"
                                      strokeLinejoin="round"
                                      paintOrder="stroke fill"
                                      fontSize="15.5"
                                      fontWeight="900"
                                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Impact, Arial, sans-serif"
                                      letterSpacing="0.04em"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                    >
                                      {seg.label}
                                    </text>
                                  </g>
                                )}

                                <circle cx={pegX} cy={pegY} r="3" fill="#fef08a" stroke="#0c1a3b" strokeWidth="1.5" />
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Center Hexagonal Heart Badge */}
                      <div style={{
                        position: "absolute",
                        width: 54,
                        height: 54,
                        zIndex: 30,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))",
                        pointerEvents: "none"
                      }}>
                        <div style={{
                          position: "absolute",
                          width: 54,
                          height: 54,
                          borderRadius: "50%",
                          background: "#0284c7",
                          border: "3.5px solid #0c1a3b",
                          boxShadow: "0 0 10px rgba(2, 132, 199, 0.6)"
                        }} />

                        <div style={{
                          position: "relative",
                          width: 38,
                          height: 38,
                          background: "linear-gradient(135deg, #fef08a 0%, #eab308 100%)",
                          border: "2.5px solid #0c1a3b",
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="#dc2626"
                            style={{
                              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
                              transform: wheelSpinning ? "scale(1.25)" : "scale(1)",
                              transition: "transform 0.3s ease"
                            }}
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Fiesta Arch Stand Ribbon */}
                    <div style={{
                      position: "relative",
                      width: "100%",
                      marginTop: -32,
                      zIndex: 25,
                      background: "#0284c7",
                      border: "3.5px solid #0c1a3b",
                      borderRadius: 18,
                      padding: "8px 12px",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {/* Colorful Aztec Triangle Bunting Garland */}
                      <div style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0 6px"
                      }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#dc2626",
                          border: "2px solid #ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.68rem",
                          color: "#ffffff"
                        }}>
                          ✿
                        </div>

                        <div style={{ display: "flex", gap: 5 }}>
                          {["#facc15", "#16a34a", "#dc2626", "#facc15", "#16a34a", "#dc2626"].map((c, i) => (
                            <div
                              key={i}
                              style={{
                                width: 0,
                                height: 0,
                                borderLeft: "5px solid transparent",
                                borderRight: "5px solid transparent",
                                borderTop: `9px solid ${c}`
                              }}
                            />
                          ))}
                        </div>

                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#dc2626",
                          border: "2px solid #ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.68rem",
                          color: "#ffffff"
                        }}>
                          ✿
                        </div>
                      </div>

                      {/* Action Button */}
                      {wheelClaimedToday ? (
                        <div style={{ width: "100%", textAlign: "center" }}>
                          <div style={{
                            background: "rgba(0,0,0,0.35)",
                            border: "1.5px solid rgba(250, 204, 21, 0.4)",
                            borderRadius: 12,
                            padding: "6px 10px",
                            marginBottom: 4
                          }}>
                            <div style={{ color: "#facc15", fontWeight: 800, fontSize: "0.78rem" }}>
                              ✓ Daily Spin Completed
                            </div>
                            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.68rem" }}>
                              Next free spin unlocks tomorrow at 00:00 UTC!
                            </div>
                          </div>
                          <button
                            disabled
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: 18,
                              background: "rgba(255,255,255,0.1)",
                              color: "rgba(255,255,255,0.4)",
                              border: "1.5px solid rgba(255,255,255,0.2)",
                              fontSize: "0.8rem",
                              fontWeight: 800,
                              cursor: "not-allowed"
                            }}
                          >
                            🔒 Come Back Tomorrow
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleSpinDailyWheel}
                          disabled={wheelSpinning || claiming}
                          style={{
                            width: "92%",
                            padding: "10px 16px",
                            borderRadius: 22,
                            background: wheelSpinning
                              ? "#ca8a04"
                              : "linear-gradient(180deg, #fef08a 0%, #facc15 60%, #eab308 100%)",
                            color: "#0c1a3b",
                            border: "3px solid #0c1a3b",
                            fontWeight: 900,
                            fontSize: "0.96rem",
                            letterSpacing: "0.03em",
                            cursor: wheelSpinning ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "transform 0.15s ease"
                          }}
                        >
                          <span>{wheelSpinning ? "SPINNING IN PROGRESS..." : "SPINNING IN 3.. 🎯"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Prize / Result Banner */}
                  {wheelPrizeResult && (
                    <div style={{
                      width: "100%",
                      maxWidth: 320,
                      padding: "10px",
                      borderRadius: 14,
                      background: wheelPrizeResult.xp === 0
                        ? "linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(12, 26, 59, 0.95) 100%)"
                        : "linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(12, 26, 59, 0.95) 100%)",
                      border: wheelPrizeResult.xp === 0 ? "2px solid #dc2626" : "2px solid #facc15",
                      textAlign: "center",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.45)"
                    }}>
                      <div style={{ fontSize: "1.4rem", marginBottom: 2 }}>
                        {wheelPrizeResult.xp === 0 ? "💀 😢" : "🎉 🏆"}
                      </div>
                      <div style={{
                        color: wheelPrizeResult.xp === 0 ? "#f87171" : "#fde047",
                        fontWeight: 900,
                        fontSize: "1.05rem"
                      }}>
                        {wheelPrizeResult.xp === 0 ? "BOKYA! (0 XP)" : `Panalo! +${wheelPrizeResult.xp} XP!`}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.76rem", marginTop: 2 }}>
                        {wheelPrizeResult.xp === 0
                          ? "No XP awarded this round. Better luck tomorrow!"
                          : `+${wheelPrizeResult.xp} XP credited to your profile!`}
                      </div>
                    </div>
                  )}
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
                    {(milestones && milestones.length > 0 ? milestones : initialMilestones).map((b) => {
                      const unlocked = userXp >= b.xp;
                      return (
                        <div
                          key={b.id || b.name}
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
                      const isDailySpin = c.quest_id === "daily-claim" || String(c.quest_id).startsWith("daily-claim-");
                      const title =
                        c.quest_id === "register"
                          ? "⚡ Register for BlockQuest Fiesta PH"
                          : c.quest_id === "checkin"
                            ? "🎟️ Gate Entrance Check-in"
                            : isDailySpin
                              ? "🎡 Daily Wheel of Luck"
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
                                          ? "rgba(239, 68, 68, 0.25)"
                                          : "rgba(245, 158, 11, 0.16)",
                                    color:
                                      v.status === "Approved"
                                        ? "#34d399"
                                        : v.status === "Rejected"
                                          ? "#fecaca"
                                          : "#fbbf24",
                                    border:
                                      v.status === "Approved"
                                        ? "1px solid rgba(16, 185, 129, 0.3)"
                                        : v.status === "Rejected"
                                          ? "1px solid rgba(239, 68, 68, 0.6)"
                                          : "1px solid rgba(245, 158, 11, 0.3)",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0
                                  }}
                                >
                                  {v.status === "Approved" ? (v.displayStatus || "✓ Claimed") : v.status === "Rejected" ? "⚠️ Needs Retry" : "⏳ Pending"}
                                </span>
                              </div>

                              {v.status === "Rejected" && v.rejection_reason && (
                                <div style={{ fontSize: "0.72rem", color: "#fca5a5", background: "rgba(239, 68, 68, 0.12)", border: "1px dashed rgba(239, 68, 68, 0.35)", padding: "5px 8px", borderRadius: 6 }}>
                                  💬 <strong>Feedback:</strong> "{v.rejection_reason}"
                                </div>
                              )}

                              {v.status === "Rejected" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchingQuest = quests.find((q) => q.id === v.quest_id);
                                    if (matchingQuest) {
                                      setSelectedQuest(matchingQuest);
                                    } else {
                                      setActiveTab("quests");
                                    }
                                  }}
                                  style={{
                                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(225, 29, 72, 0.3) 100%)",
                                    border: "1px solid rgba(239, 68, 68, 0.6)",
                                    color: "#fecaca",
                                    padding: "5px 10px",
                                    borderRadius: 6,
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    marginTop: 2
                                  }}
                                >
                                  <span>🔄 Open Quest to Fix & Retry</span>
                                  <span>→</span>
                                </button>
                              )}

                              {v.user_message && v.status !== "Rejected" && (
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

                {/* 💬 Helpdesk & Feedback Support Card */}
                <div
                  className="info-card"
                  style={{
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.04) 100%)",
                    border: "1px solid rgba(59, 130, 246, 0.28)",
                    borderRadius: 16,
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "rgba(59, 130, 246, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                        }}
                      >
                        💬
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#fff" }}>
                          Feedback & Support
                        </h4>
                        <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                          Report issues or submit tickets to event admins
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(true)}
                    style={{
                      width: "100%",
                      padding: "11px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      color: "#fff",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <span>🎫 Create Support Ticket / Send Feedback</span>
                    <span>→</span>
                  </button>
                </div>

                {qrPass && (
                  <div
                    className="info-card"
                    style={{
                      background: "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.05) 100%)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: 16,
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "rgba(59, 130, 246, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem",
                          }}
                        >
                          🎁
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#fff" }}>
                            Referral Program
                          </h4>
                          <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                            Earn +100 XP per friend (Max 5 referrals)
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fbbf24", whiteSpace: "nowrap" }}>
                        {Math.min(userReferralCount, 5)}/5 Friends (+{Math.min(userReferralCount, 5) * 100} XP)
                      </span>
                    </div>

                    {(() => {
                      const refIdentifier = userAlias || qrPass?.passCode || authenticatedUser?.ticket_code || authenticatedUser?.email?.split("@")[0] || "FRIEND";
                      const origin = typeof window !== "undefined" ? window.location.origin : "https://block-quest.com";
                      const referralUrl = `${origin}/register?ref=${encodeURIComponent(refIdentifier)}`;

                      return (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            readOnly
                            value={referralUrl}
                            style={{
                              flex: 1,
                              background: "rgba(0, 0, 0, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              borderRadius: 10,
                              padding: "9px 12px",
                              color: "#f8fafc",
                              fontSize: "0.78rem",
                              fontFamily: "monospace",
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(referralUrl);
                                showNotice("Referral link copied to clipboard! Share it with your friends.", "success", "Link Copied! 📋", "📋");
                              }
                            }}
                            style={{
                              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                              border: "none",
                              color: "#fff",
                              padding: "9px 14px",
                              borderRadius: 10,
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            📋 Copy
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {qrPass && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => {
                        setAliasModalError("");
                        setAliasInput(userAlias || "");
                        setShowAliasModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 12,
                        border: "1px solid rgba(245, 166, 35, 0.4)",
                        background: userAlias ? "rgba(245, 166, 35, 0.08)" : "linear-gradient(135deg, rgba(245, 166, 35, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%)",
                        color: "#fbbf24",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingLeft: 16,
                        paddingRight: 16,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🛡️</span> Leaderboard Alias Name
                      </span>
                      <span style={{
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 8,
                        background: userAlias ? "rgba(245, 166, 35, 0.2)" : "rgba(255, 255, 255, 0.1)",
                        color: userAlias ? "var(--gold-light)" : "var(--text-muted)"
                      }}>
                        {userAlias ? `@${userAlias}` : "Not Set (Masked) ✏️"}
                      </span>
                    </button>

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
            {/* Dedicated Interactive Peryahan Roleta Wheel Action Button */}
            <button
              onClick={() => {
                setActiveTab("peryahan");
                // Check if already claimed today
                const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
                const todayStr = new Date().toISOString().slice(0, 10);
                const dailyQuest = quests.find((q) => q.id === "daily-claim");
                const isDone = dailyQuest?.status === "Done" || (email && typeof window !== "undefined" && !!localStorage.getItem(`bq_daily_wheel_${email}_${todayStr}`));
                setWheelClaimedToday(!!isDone);
              }}
              className={`tab-btn--peryahan ${activeTab === "peryahan" ? "tab-btn--active" : ""} ${wheelSpinning ? "is-spinning" : ""}`}
              aria-label="Peryahan Wheel of Spin"
            >
              <div className="peryahan-btn-floating">
                {!wheelClaimedToday && <div className="peryahan-btn-floating__pulse" />}
                <div className="peryahan-btn-floating__ring" />
                <span className="peryahan-btn-icon">🎡</span>
                {!wheelClaimedToday && (
                  <span className="peryahan-badge-free">FREE</span>
                )}
              </div>
              <span className="peryahan-label">Peryahan</span>
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
                  <div className="modal-xp-reward">
                    {liveQuest.id === "daily-claim" ? "🎪 Peryahan Wheel: 0 ~ 100 XP" : liveQuest.id === "referral-quest" ? "+100 XP per Friend (Max 5)" : `Reward: ${liveQuest.xp} XP`}
                  </div>
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
                        const isDiscordQuest = selectedQuest.id === "discord-member" || !!(selectedQuest as any).discord_guild_id || (selectedQuest.title || "").toLowerCase().includes("discord");
                        const isTelegramQuest = selectedQuest.id === "join-tg" || !!(selectedQuest as any).telegram_chat_id || (selectedQuest.title || "").toLowerCase().includes("telegram");
                        const isSpecialCustomQuest = selectedQuest.id === "referral-quest" || selectedQuest.id === "add-alias" || selectedQuest.id === "promo-bonus";
                        const hasAction = !!selectedQuest.actionUrl && !isSpecialCustomQuest;
                        const isActionCompleted = !hasAction || !!visitedActions[selectedQuest.id];
                        return (
                          <>
                            {selectedQuest.actionUrl && !isDiscordQuest && !isTelegramQuest && !isSpecialCustomQuest && (
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

                            {hasAction && !isActionCompleted && !isDiscordQuest && (
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
                                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.15) 100%)",
                                  border: "1.5px solid rgba(239, 68, 68, 0.7)",
                                  padding: "16px 16px",
                                  borderRadius: 14,
                                  marginBottom: 16,
                                  boxShadow: "0 4px 20px rgba(239, 68, 68, 0.25)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <div style={{ color: "#fecaca", fontWeight: 900, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: "1.2rem" }}>🚨</span>
                                      <span>Action Needed: Proof Rejected</span>
                                    </div>
                                    <span style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 900,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      background: "rgba(239, 68, 68, 0.4)",
                                      color: "#fff",
                                      border: "1px solid rgba(255, 255, 255, 0.3)",
                                      textTransform: "uppercase"
                                    }}>
                                      Retry Open
                                    </span>
                                  </div>
                                  
                                  {lastVerif?.rejection_reason && (
                                    <div style={{
                                      background: "rgba(0, 0, 0, 0.35)",
                                      border: "1px dashed rgba(248, 113, 113, 0.5)",
                                      padding: "10px 12px",
                                      borderRadius: 10,
                                      color: "#fca5a5",
                                      fontSize: "0.84rem",
                                      marginTop: 10,
                                      lineHeight: 1.45
                                    }}>
                                      <div style={{ color: "#f87171", fontWeight: 800, fontSize: "0.72rem", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                        Reviewer Feedback:
                                      </div>
                                      "{lastVerif.rejection_reason}"
                                    </div>
                                  )}
                                  
                                  <div style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "0.8rem", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>👉</span>
                                    <span>Please fix your proof screenshot or link below and tap <strong>Resubmit for Verification</strong>.</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {(!((selectedQuest.id === "join-tg" || (selectedQuest as any).telegram_chat_id || (selectedQuest.title || "").toLowerCase().includes("telegram")) || (selectedQuest.id === "discord-member" || !!(selectedQuest as any).discord_guild_id || (selectedQuest.title || "").toLowerCase().includes("discord"))) && (selectedQuest.requiresProof || selectedQuest.requiresMessage) && selectedQuest.status !== "Approved") ? (
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
                                        fontSize: "0.92rem",
                                        border: "none",
                                        background: isReady
                                          ? selectedQuest.status === "Rejected"
                                            ? "linear-gradient(135deg, #ef4444 0%, #f43f5e 50%, #e11d48 100%)"
                                            : "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)"
                                          : "rgba(255, 255, 255, 0.08)",
                                        color: isReady ? "#fff" : "rgba(255, 255, 255, 0.4)",
                                        boxShadow: isReady
                                          ? selectedQuest.status === "Rejected"
                                            ? "0 0 25px rgba(239, 68, 68, 0.5)"
                                            : "0 0 25px rgba(168, 85, 247, 0.4)"
                                          : "none",
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
                            ) : selectedQuest.id === "daily-claim" ? (
                              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", width: "100%" }}>
                                {/* Mexican Fiesta Arch Container */}
                                <div style={{
                                  position: "relative",
                                  width: "100%",
                                  maxWidth: 360,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center"
                                }}>
                                  {/* Fiesta Golden Arch Frame with Navy Outline */}
                                  <div style={{
                                    position: "relative",
                                    width: 330,
                                    height: 330,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.6))"
                                  }}>
                                    {/* Outer Deep Navy Arch Ring */}
                                    <div style={{
                                      position: "absolute",
                                      width: 326,
                                      height: 326,
                                      borderRadius: "50%",
                                      background: "#0c1a3b",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}>
                                      {/* Bold Golden Yellow Rim */}
                                      <div style={{
                                        position: "absolute",
                                        width: 308,
                                        height: 308,
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
                                        border: "4px solid #0c1a3b",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                      }}>
                                        {/* Inner Red Accent Ring */}
                                        <div style={{
                                          position: "absolute",
                                          width: 284,
                                          height: 284,
                                          borderRadius: "50%",
                                          background: "#dc2626",
                                          border: "3px solid #0c1a3b",
                                          overflow: "hidden"
                                        }} />
                                      </div>
                                    </div>

                                    {/* Top Fiery Diamond Pointer Pin (Pointing downward to top slice) */}
                                    <div style={{
                                      position: "absolute",
                                      top: -12,
                                      left: "50%",
                                      transform: "translateX(-50%)",
                                      zIndex: 40,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      filter: "drop-shadow(0 5px 8px rgba(0,0,0,0.7))"
                                    }}>
                                      {/* Diamond Gem */}
                                      <div style={{
                                        width: 30,
                                        height: 30,
                                        background: "linear-gradient(135deg, #fde047 0%, #ea580c 60%, #b91c1c 100%)",
                                        border: "3px solid #0c1a3b",
                                        borderRadius: 6,
                                        transform: "rotate(45deg)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                      }}>
                                        <div style={{
                                          width: 12,
                                          height: 12,
                                          background: "#ffffff",
                                          borderRadius: 3,
                                          opacity: 0.9
                                        }} />
                                      </div>
                                      {/* Pointer Arrow Tip */}
                                      <div style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: "11px solid transparent",
                                        borderRight: "11px solid transparent",
                                        borderTop: "16px solid #b91c1c",
                                        marginTop: -7
                                      }} />
                                    </div>

                                    {/* Rotating Wheel Disc with Fiesta Graphics */}
                                    <div style={{
                                      position: "relative",
                                      width: 278,
                                      height: 278,
                                      borderRadius: "50%",
                                      overflow: "hidden",
                                      transform: `rotate(${wheelRotation}deg)`,
                                      transition: wheelSpinning
                                        ? "transform 8.5s cubic-bezier(0.15, 0.95, 0.2, 1)"
                                        : "transform 0.4s ease-out",
                                      zIndex: 10
                                    }}>
                                      <svg viewBox="0 0 240 240" width="100%" height="100%">
                                        <defs>
                                          <filter id="fiestaTextDrop" x="-30%" y="-30%" width="160%" height="160%">
                                            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.9" />
                                          </filter>
                                        </defs>

                                        {WHEEL_SEGMENTS.map((seg, idx) => {
                                          const anglePerSeg = 360 / WHEEL_SEGMENTS.length;
                                          const startAngle = idx * anglePerSeg - 90;
                                          const endAngle = (idx + 1) * anglePerSeg - 90;
                                          const startRad = (startAngle * Math.PI) / 180;
                                          const endRad = (endAngle * Math.PI) / 180;
                                          const x1 = 120 + 120 * Math.cos(startRad);
                                          const y1 = 120 + 120 * Math.sin(startRad);
                                          const x2 = 120 + 120 * Math.cos(endRad);
                                          const y2 = 120 + 120 * Math.sin(endRad);
                                          const pathData = `M 120 120 L ${x1} ${y1} A 120 120 0 0 1 ${x2} ${y2} Z`;

                                          const midAngle = startAngle + anglePerSeg / 2;
                                          const textRad = (midAngle * Math.PI) / 180;

                                          // Outer position for chevron arrow / dot ornament
                                          const arrowX = 120 + 96 * Math.cos(textRad);
                                          const arrowY = 120 + 96 * Math.sin(textRad);

                                          // Mid position for text or calavera icon
                                          const textX = 120 + 72 * Math.cos(textRad);
                                          const textY = 120 + 72 * Math.sin(textRad);

                                          // Inner peg circle on boundary line
                                          const pegX = 120 + 38 * Math.cos(startRad);
                                          const pegY = 120 + 38 * Math.sin(startRad);

                                          const isBokya = seg.tier === "Bokya";

                                          return (
                                            <g key={idx}>
                                              {/* Slice background */}
                                              <path
                                                d={pathData}
                                                fill={seg.color}
                                                stroke="#0c1a3b"
                                                strokeWidth="3"
                                              />

                                              {/* Outer Chevron Flag / Arrow Motif like Reference */}
                                              <g transform={`rotate(${midAngle + 90}, ${arrowX}, ${arrowY})`}>
                                                <polyline
                                                  points={`${arrowX - 8},${arrowY - 4} ${arrowX},${arrowY + 4} ${arrowX + 8},${arrowY - 4}`}
                                                  fill="none"
                                                  stroke={isBokya ? "#fde047" : "#ffffff"}
                                                  strokeWidth="2.5"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                                <circle
                                                  cx={arrowX}
                                                  cy={arrowY - 7}
                                                  r="2.5"
                                                  fill={isBokya ? "#fde047" : "#ffffff"}
                                                />
                                              </g>

                                              {/* Slice Content: Calavera Skull + sharp Bokya label for Bokya, razor-sharp vertical radial text for XP */}
                                              {isBokya ? (
                                                <g transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}>
                                                  {/* Calavera Sugar Skull Graphic with sharp borders */}
                                                  <circle cx={textX} cy={textY - 3} r="13" fill="#facc15" stroke="#0c1a3b" strokeWidth="2.5" />
                                                  {/* Skull eyes */}
                                                  <circle cx={textX - 4.5} cy={textY - 5} r="2.8" fill="#dc2626" />
                                                  <circle cx={textX + 4.5} cy={textY - 5} r="2.8" fill="#dc2626" />
                                                  {/* Nose */}
                                                  <polygon points={`${textX},${textY - 2} ${textX - 2},${textY + 1} ${textX + 2},${textY + 1}`} fill="#0c1a3b" />
                                                  {/* Teeth */}
                                                  <rect x={textX - 5.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                                  <rect x={textX - 1.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                                  <rect x={textX + 2.5} cy={textY + 3} y={textY + 3} width="3" height="3" rx="0.5" fill="#ffffff" stroke="#0c1a3b" strokeWidth="1" />
                                                  {/* Ultra-sharp BOKYA text badge below skull */}
                                                  <text
                                                    x={textX}
                                                    y={textY + 14}
                                                    fill="#ffffff"
                                                    stroke="#0c1a3b"
                                                    strokeWidth="3"
                                                    strokeLinejoin="round"
                                                    paintOrder="stroke fill"
                                                    fontSize="8.5"
                                                    fontWeight="900"
                                                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Impact, sans-serif"
                                                    letterSpacing="0.08em"
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                  >
                                                    BOKYA
                                                  </text>
                                                </g>
                                              ) : (
                                                <g transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}>
                                                  {/* Crisp, ultra-sharp text with heavy dark outline for maximum legibility */}
                                                  <text
                                                    x={textX}
                                                    y={textY}
                                                    fill="#ffffff"
                                                    stroke="#0c1a3b"
                                                    strokeWidth="3.5"
                                                    strokeLinejoin="round"
                                                    paintOrder="stroke fill"
                                                    fontSize="15.5"
                                                    fontWeight="900"
                                                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Impact, Arial, sans-serif"
                                                    letterSpacing="0.04em"
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                  >
                                                    {seg.label}
                                                  </text>
                                                </g>
                                              )}

                                              {/* Inner golden divider rivet */}
                                              <circle cx={pegX} cy={pegY} r="3" fill="#fef08a" stroke="#0c1a3b" strokeWidth="1.5" />
                                            </g>
                                          );
                                        })}
                                      </svg>
                                    </div>

                                    {/* Center Hexagonal Heart Badge (from reference image) */}
                                    <div style={{
                                      position: "absolute",
                                      width: 62,
                                      height: 62,
                                      zIndex: 30,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))",
                                      pointerEvents: "none"
                                    }}>
                                      {/* Outer Blue Hex/Circle Frame */}
                                      <div style={{
                                        position: "absolute",
                                        width: 62,
                                        height: 62,
                                        borderRadius: "50%",
                                        background: "#0284c7",
                                        border: "4px solid #0c1a3b",
                                        boxShadow: "0 0 10px rgba(2, 132, 199, 0.6)"
                                      }} />

                                      {/* Golden Hexagon with Red Heart */}
                                      <div style={{
                                        position: "relative",
                                        width: 44,
                                        height: 44,
                                        background: "linear-gradient(135deg, #fef08a 0%, #eab308 100%)",
                                        border: "3px solid #0c1a3b",
                                        borderRadius: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                      }}>
                                        <svg
                                          width="20"
                                          height="20"
                                          viewBox="0 0 24 24"
                                          fill="#dc2626"
                                          style={{
                                            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))",
                                            transform: wheelSpinning ? "scale(1.25)" : "scale(1)",
                                            transition: "transform 0.3s ease"
                                          }}
                                        >
                                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom Fiesta Arch Stand Ribbon (Matching Reference Bottom Bar) */}
                                  <div style={{
                                    position: "relative",
                                    width: "100%",
                                    marginTop: -38,
                                    zIndex: 25,
                                    background: "#0284c7",
                                    border: "4px solid #0c1a3b",
                                    borderRadius: 22,
                                    padding: "10px 14px",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.55)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 8
                                  }}>
                                    {/* Colorful Aztec Triangle Bunting Garland */}
                                    <div style={{
                                      width: "100%",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "0 8px"
                                    }}>
                                      {/* Left Flower Rosette */}
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        background: "#dc2626",
                                        border: "2px solid #ffffff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        color: "#ffffff"
                                      }}>
                                        ✿
                                      </div>

                                      {/* Festive Geometric Zigzag Pennants */}
                                      <div style={{ display: "flex", gap: 6 }}>
                                        {["#facc15", "#16a34a", "#dc2626", "#facc15", "#16a34a", "#dc2626"].map((c, i) => (
                                          <div
                                            key={i}
                                            style={{
                                              width: 0,
                                              height: 0,
                                              borderLeft: "6px solid transparent",
                                              borderRight: "6px solid transparent",
                                              borderTop: `10px solid ${c}`
                                            }}
                                          />
                                        ))}
                                      </div>

                                      {/* Right Flower Rosette */}
                                      <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: "50%",
                                        background: "#dc2626",
                                        border: "2px solid #ffffff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        color: "#ffffff"
                                      }}>
                                        ✿
                                      </div>
                                    </div>

                                    {/* Action Button: Pill-Shaped Yellow Spin Button (Exact Reference Match) */}
                                    {wheelClaimedToday ? (
                                      <div style={{ width: "100%", textAlign: "center" }}>
                                        <div style={{
                                          background: "rgba(0,0,0,0.35)",
                                          border: "2px solid rgba(250, 204, 21, 0.4)",
                                          borderRadius: 14,
                                          padding: "8px 12px",
                                          marginBottom: 6
                                        }}>
                                          <div style={{ color: "#facc15", fontWeight: 800, fontSize: "0.85rem" }}>
                                            ✓ Daily Spin Completed
                                          </div>
                                          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.72rem" }}>
                                            Next free spin unlocks tomorrow at 00:00 UTC!
                                          </div>
                                        </div>
                                        <button
                                          disabled
                                          style={{
                                            width: "100%",
                                            padding: "10px",
                                            borderRadius: 20,
                                            background: "rgba(255,255,255,0.1)",
                                            color: "rgba(255,255,255,0.4)",
                                            border: "2px solid rgba(255,255,255,0.2)",
                                            fontSize: "0.85rem",
                                            fontWeight: 800,
                                            cursor: "not-allowed"
                                          }}
                                        >
                                          🔒 Come Back Tomorrow
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={handleSpinDailyWheel}
                                        disabled={wheelSpinning || claiming}
                                        style={{
                                          width: "90%",
                                          padding: "12px 18px",
                                          borderRadius: 25,
                                          background: wheelSpinning
                                            ? "#ca8a04"
                                            : "linear-gradient(180deg, #fef08a 0%, #facc15 60%, #eab308 100%)",
                                          color: "#0c1a3b",
                                          border: "3.5px solid #0c1a3b",
                                          fontWeight: 900,
                                          fontSize: "1.05rem",
                                          letterSpacing: "0.04em",
                                          cursor: wheelSpinning ? "not-allowed" : "pointer",
                                          boxShadow: "0 4px 14px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.8)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 8,
                                          transition: "transform 0.15s ease"
                                        }}
                                      >
                                        <span>{wheelSpinning ? "SPINNING IN PROGRESS..." : "SPINNING IN 3.. 🎯"}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Prize / Result Banner */}
                                {wheelPrizeResult && (
                                  <div style={{
                                    width: "100%",
                                    padding: "14px",
                                    borderRadius: 16,
                                    background: wheelPrizeResult.xp === 0
                                      ? "linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(12, 26, 59, 0.95) 100%)"
                                      : "linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(12, 26, 59, 0.95) 100%)",
                                    border: wheelPrizeResult.xp === 0 ? "2px solid #dc2626" : "2px solid #facc15",
                                    textAlign: "center",
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.45)"
                                  }}>
                                    <div style={{ fontSize: "1.8rem", marginBottom: 2 }}>
                                      {wheelPrizeResult.xp === 0 ? "💀 😢" : "🎉 🏆"}
                                    </div>
                                    <div style={{
                                      color: wheelPrizeResult.xp === 0 ? "#f87171" : "#fde047",
                                      fontWeight: 900,
                                      fontSize: "1.15rem"
                                    }}>
                                      {wheelPrizeResult.xp === 0 ? "BOKYA! (0 XP)" : `Panalo! +${wheelPrizeResult.xp} XP!`}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.82rem", marginTop: 4 }}>
                                      {wheelPrizeResult.xp === 0
                                        ? "No XP awarded this round. Better luck tomorrow!"
                                        : `+${wheelPrizeResult.xp} XP credited to your profile!`}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : selectedQuest.id === "promo-bonus" ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                {userPromoCode ? (
                                  <>
                                    <div style={{
                                      background: "rgba(16, 185, 129, 0.15)",
                                      border: "1px solid rgba(16, 185, 129, 0.4)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🎁 ✅</div>
                                      <div style={{ color: "#34d399", fontWeight: 800, fontSize: "1rem" }}>
                                        Promo Code Applied: {userPromoCode}
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        Your account was registered with official promo code <strong>{userPromoCode}</strong>. Click below to claim your bonus 250 XP reward!
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
                                      {claiming ? "Claiming +250 XP..." : "🎉 Claim +250 Promo Bonus XP →"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{
                                      background: "rgba(239, 68, 68, 0.15)",
                                      border: "1px solid rgba(239, 68, 68, 0.35)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🔒 ❌</div>
                                      <div style={{ color: "#f87171", fontWeight: 800, fontSize: "1rem" }}>
                                        Promo Code Required
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        This bonus XP is strictly available for attendees who registered using an official promo code or referral link. No promo code was applied to your account during registration.
                                      </div>
                                    </div>
                                    <button
                                      disabled
                                      className="modal-claim-btn"
                                      style={{
                                        width: "100%",
                                        padding: "15px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "0.95rem",
                                        background: "rgba(255, 255, 255, 0.08)",
                                        color: "rgba(255, 255, 255, 0.4)",
                                        border: "none",
                                        cursor: "not-allowed",
                                        opacity: 0.6
                                      }}
                                    >
                                      🔒 Promo Code Required to Claim XP
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : selectedQuest.id === "add-alias" ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                {userAlias ? (
                                  <>
                                    <div style={{
                                      background: "rgba(16, 185, 129, 0.15)",
                                      border: "1px solid rgba(16, 185, 129, 0.4)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🛡️ ✅</div>
                                      <div style={{ color: "#34d399", fontWeight: 800, fontSize: "1rem" }}>
                                        Alias Configured: @{userAlias}
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        You have customized your profile with a public alias. Click below to claim your +50 XP reward!
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
                                      {claiming ? "Claiming +50 XP..." : "🎉 Claim +50 Alias XP →"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{
                                      background: "rgba(245, 166, 35, 0.12)",
                                      border: "1px solid rgba(245, 166, 35, 0.35)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🛡️ ✏️</div>
                                      <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1rem" }}>
                                        Alias Name Required
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        Personalize your identity by setting an alias for your profile. Your alias will replace your full name on the global rankings!
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedQuest(null);
                                        setAliasModalError("");
                                        setAliasInput("");
                                        setShowAliasModal(true);
                                      }}
                                      className="modal-claim-btn"
                                      style={{
                                        width: "100%",
                                        padding: "15px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "0.95rem",
                                        background: "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                                        color: "#100b02",
                                        border: "none",
                                        cursor: "pointer",
                                      }}
                                    >
                                      🛡️ Create My Alias Name Now →
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : selectedQuest.id === "referral-quest" ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                {authenticatedUser || qrPass ? (
                                  <>
                                    <div style={{
                                      background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)",
                                      border: "1px solid rgba(59, 130, 246, 0.35)",
                                      padding: "16px",
                                      borderRadius: 14,
                                      textAlign: "center"
                                    }}>
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🎁 🤝</div>
                                      <div style={{ color: "#60a5fa", fontWeight: 800, fontSize: "1.05rem" }}>
                                        Your Personal Referral Link
                                      </div>
                                      <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.82rem", margin: "6px 0 12px", lineHeight: 1.4 }}>
                                        Share your referral link with friends. Whenever someone signs up using your link, you instantly receive <strong>+100 XP</strong>!
                                      </p>

                                      {/* Referral Link Copy Box */}
                                      {(() => {
                                        const refIdentifier = userAlias || qrPass?.passCode || authenticatedUser?.ticket_code || authenticatedUser?.email?.split("@")[0] || "FRIEND";
                                        const origin = typeof window !== "undefined" ? window.location.origin : "https://block-quest.com";
                                        const referralUrl = `${origin}/register?ref=${encodeURIComponent(refIdentifier)}`;

                                        return (
                                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <div style={{
                                              display: "flex",
                                              alignItems: "center",
                                              background: "rgba(0, 0, 0, 0.45)",
                                              border: "1px solid rgba(255, 255, 255, 0.15)",
                                              borderRadius: 10,
                                              padding: "8px 12px",
                                              gap: 8,
                                              overflow: "hidden"
                                            }}>
                                              <input
                                                type="text"
                                                readOnly
                                                value={referralUrl}
                                                style={{
                                                  flex: 1,
                                                  background: "transparent",
                                                  border: "none",
                                                  color: "#f8fafc",
                                                  fontSize: "0.78rem",
                                                  fontFamily: "monospace",
                                                  outline: "none"
                                                }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (navigator.clipboard) {
                                                    navigator.clipboard.writeText(referralUrl);
                                                    showNotice("Referral link copied to clipboard! Share it with your friends.", "success", "Link Copied! 📋", "📋");
                                                  }
                                                }}
                                                style={{
                                                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                                                  border: "none",
                                                  color: "#fff",
                                                  padding: "6px 12px",
                                                  borderRadius: 8,
                                                  fontSize: "0.76rem",
                                                  fontWeight: 800,
                                                  cursor: "pointer",
                                                  whiteSpace: "nowrap"
                                                }}
                                              >
                                                📋 Copy
                                              </button>
                                            </div>

                                            {/* Referral Stats Badge */}
                                            <div style={{
                                              display: "flex",
                                              justifyContent: "space-around",
                                              background: "rgba(255, 255, 255, 0.04)",
                                              borderRadius: 10,
                                              padding: "10px",
                                              border: "1px solid rgba(255, 255, 255, 0.08)"
                                            }}>
                                              <div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Friends Joined (Max 5)</div>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                                                  {Math.min(userReferralCount, 5)} / 5
                                                </div>
                                              </div>
                                              <div style={{ width: 1, background: "rgba(255, 255, 255, 0.1)" }} />
                                              <div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Referral XP Earned</div>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fbbf24" }}>
                                                  +{Math.min(userReferralCount, 5) * 100} XP
                                                </div>
                                              </div>
                                            </div>

                                            {/* Share Shortcut Buttons */}
                                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                              <a
                                                href={`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent("Join me at BlockQuest Fiesta PH! Register here to unlock exclusive quests & win prizes:")}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                  flex: 1,
                                                  padding: "9px 8px",
                                                  borderRadius: 10,
                                                  background: "rgba(34, 158, 217, 0.2)",
                                                  border: "1px solid rgba(34, 158, 217, 0.4)",
                                                  color: "#38bdf8",
                                                  fontSize: "0.76rem",
                                                  fontWeight: 700,
                                                  textAlign: "center",
                                                  textDecoration: "none",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  gap: 6
                                                }}
                                              >
                                                ✈️ Share Telegram
                                              </a>
                                              <a
                                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Join me at BlockQuest Fiesta PH! Register now:")}&url=${encodeURIComponent(referralUrl)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                  flex: 1,
                                                  padding: "9px 8px",
                                                  borderRadius: 10,
                                                  background: "rgba(255, 255, 255, 0.08)",
                                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                                  color: "#fff",
                                                  fontSize: "0.76rem",
                                                  fontWeight: 700,
                                                  textAlign: "center",
                                                  textDecoration: "none",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  gap: 6
                                                }}
                                              >
                                                𝕏 Share on X
                                              </a>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
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
                                      <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🔗 🔒</div>
                                      <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1rem" }}>
                                        Ticket Account Required
                                      </div>
                                      <div style={{ color: "rgba(255, 255, 255, 0.75)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 }}>
                                        Link or sign into your registered attendee ticket pass on the Profile tab to generate your personal referral invite link.
                                      </div>
                                    </div>
                                    <button
                                      type="button"
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
                                        fontSize: "0.92rem",
                                        background: "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                                        color: "#100b02",
                                        border: "none",
                                        cursor: "pointer",
                                      }}
                                    >
                                      🔑 Link Ticket on Profile Tab →
                                    </button>
                                  </>
                                )}
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
                                        {!authenticatedUser
                                          ? "Link or sign into your ticket account on the Profile tab first so your gate check-in status can be verified."
                                          : "Scan your QR ticket pass at the event entrance gate. Once scanned by gate staff, this 500 XP reward unlocks automatically!"}
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
                                      {!authenticatedUser ? "🔑 Link Ticket on Profile →" : "🎫 View My QR Ticket Pass →"}
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
                             ) : (selectedQuest.id === "join-tg" || (selectedQuest as any).telegram_chat_id || (selectedQuest.title || "").toLowerCase().includes("telegram")) ? (
                                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                                  {/* STEP 1 CARD */}
                                  <div style={{
                                    background: isActionCompleted
                                      ? "rgba(16, 185, 129, 0.08)"
                                      : "rgba(36, 161, 222, 0.08)",
                                    border: isActionCompleted
                                      ? "1px solid rgba(16, 185, 129, 0.3)"
                                      : "1px solid rgba(36, 161, 222, 0.3)",
                                    borderRadius: 16,
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    transition: "all 0.3s ease"
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 800,
                                        letterSpacing: "0.03em",
                                        color: isActionCompleted ? "#34d399" : "#38bdf8",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                      }}>
                                        <span>{isActionCompleted ? "✅" : "1️⃣"}</span>
                                        STEP 1: Join the Community
                                      </span>
                                      <span style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        padding: "3px 8px",
                                        borderRadius: 20,
                                        background: isActionCompleted ? "rgba(16, 185, 129, 0.2)" : "rgba(36, 161, 222, 0.2)",
                                        color: isActionCompleted ? "#34d399" : "#60a5fa"
                                      }}>
                                        {isActionCompleted ? "Completed" : "Required"}
                                      </span>
                                    </div>

                                    <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.4 }}>
                                      Tap the button below to open and join our official Telegram group.
                                    </p>

                                    {selectedQuest.actionUrl && (
                                      <Link
                                        href={selectedQuest.actionUrl}
                                        target={selectedQuest.actionUrl.startsWith("http") ? "_blank" : undefined}
                                        className="modal-action-btn"
                                        style={{
                                          width: "100%",
                                          padding: "13px 16px",
                                          borderRadius: 12,
                                          fontWeight: 800,
                                          fontSize: "0.92rem",
                                          textAlign: "center",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 8,
                                          textDecoration: "none",
                                          boxSizing: "border-box",
                                          background: isActionCompleted
                                            ? "rgba(16, 185, 129, 0.15)"
                                            : "linear-gradient(135deg, #0088cc 0%, #24A1DE 100%)",
                                          border: isActionCompleted ? "1px solid rgba(16, 185, 129, 0.4)" : "none",
                                          color: isActionCompleted ? "#34d399" : "#ffffff",
                                          boxShadow: isActionCompleted ? "none" : "0 4px 16px rgba(0, 136, 204, 0.4)",
                                          cursor: "pointer",
                                          transition: "all 0.25s ease"
                                        }}
                                        onClick={() => {
                                          setVisitedActions((prev) => ({ ...prev, [selectedQuest.id]: true }));
                                        }}
                                      >
                                        {isActionCompleted ? (
                                          <>
                                            <span>✓</span> Joined! Click to re-open link ↗
                                          </>
                                        ) : (
                                          <>
                                            <span>✈️</span> Open & Join Telegram Group ↗
                                          </>
                                        )}
                                      </Link>
                                    )}
                                  </div>

                                  {/* STEP 2 CARD */}
                                  <div style={{
                                    background: !isActionCompleted
                                      ? "rgba(255, 255, 255, 0.03)"
                                      : "rgba(36, 161, 222, 0.08)",
                                    border: !isActionCompleted
                                      ? "1px dashed rgba(255, 255, 255, 0.15)"
                                      : "1px solid rgba(36, 161, 222, 0.3)",
                                    borderRadius: 16,
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                    opacity: isActionCompleted ? 1 : 0.65,
                                    transition: "all 0.3s ease"
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 800,
                                        letterSpacing: "0.03em",
                                        color: isActionCompleted ? "#38bdf8" : "rgba(255, 255, 255, 0.5)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6
                                      }}>
                                        <span>2️⃣</span> STEP 2: Verify Membership
                                      </span>
                                      {!isActionCompleted && (
                                        <span style={{
                                          fontSize: "0.72rem",
                                          fontWeight: 700,
                                          padding: "3px 8px",
                                          borderRadius: 20,
                                          background: "rgba(255, 255, 255, 0.08)",
                                          color: "rgba(255, 255, 255, 0.5)"
                                        }}>
                                          Locked
                                        </span>
                                      )}
                                    </div>

                                    <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.45 }}>
                                      Enter your Telegram <strong>@username</strong> or numeric ID. Our bot verifies your active membership in the group.
                                    </p>

                                    <div style={{ position: "relative" }}>
                                      <input
                                        type="text"
                                        placeholder={isActionCompleted ? "e.g. @your_username or 12345678" : "Complete Step 1 above to unlock"}
                                        value={telegramUsernameInput}
                                        onChange={(e) => setTelegramUsernameInput(e.target.value)}
                                        disabled={!isActionCompleted}
                                        style={{
                                          width: "100%",
                                          padding: "13px 14px",
                                          borderRadius: 12,
                                          border: telegramUsernameInput.trim()
                                            ? "1px solid #38bdf8"
                                            : "1px solid rgba(255, 255, 255, 0.15)",
                                          background: isActionCompleted ? "rgba(15, 23, 42, 0.85)" : "rgba(10, 15, 26, 0.4)",
                                          color: "#f8fafc",
                                          fontSize: "0.92rem",
                                          fontWeight: 600,
                                          outline: "none",
                                          boxSizing: "border-box",
                                          cursor: isActionCompleted ? "text" : "not-allowed",
                                          boxShadow: (telegramUsernameInput.trim() && isActionCompleted) ? "0 0 16px rgba(56, 189, 248, 0.2)" : "none",
                                          transition: "all 0.25s ease"
                                        }}
                                      />
                                    </div>

                                    <div style={{
                                      fontSize: "0.74rem",
                                      color: "rgba(147, 197, 253, 0.9)",
                                      background: "rgba(15, 23, 42, 0.6)",
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      lineHeight: 1.4,
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 6
                                    }}>
                                      <span>💡</span>
                                      <span><strong>Tip:</strong> If your account has no public @username or verification fails, message <strong>@userinfobot</strong> on Telegram to get your numeric ID.</span>
                                    </div>

                                    {/* Claim / Verify Button */}
                                    <button
                                      onClick={async () => {
                                        const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
                                        if (!email) {
                                          showNotice("Please register or log in first before claiming Telegram XP.", "warning", "Login Required", "🔑");
                                          return;
                                        }
                                        if (!telegramUsernameInput.trim()) {
                                          showNotice("Please enter your Telegram username or numeric ID.", "warning", "Input Required", "⚠️");
                                          return;
                                        }
                                        setClaiming(true);
                                        try {
                                          const res = await fetch("/api/auth/telegram/verify", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              quest_id: selectedQuest.id,
                                              user_email: email,
                                              telegram_username: telegramUsernameInput.trim(),
                                            }),
                                          });
                                          const json = await safeJson(res);
                                          if (!res.ok) {
                                            showNotice(json.error || "Failed to verify Telegram membership.", "error", "Verification Failed", "🔒");
                                            return;
                                          }
                                          showNotice(`Verified! You earned +${json.xp_awarded || selectedQuest.xp} XP!`, "success", "Telegram Verified!", "🎉");
                                          setSelectedQuest(null);
                                          syncUserData();
                                        } catch (err: any) {
                                          showNotice(err.message, "error", "Error", "✕");
                                        } finally {
                                          setClaiming(false);
                                        }
                                      }}
                                      disabled={claiming || !telegramUsernameInput.trim() || !isActionCompleted}
                                      className="modal-claim-btn"
                                      style={{
                                        width: "100%",
                                        padding: "14px",
                                        borderRadius: 12,
                                        fontWeight: 800,
                                        fontSize: "0.95rem",
                                        background: (telegramUsernameInput.trim() && isActionCompleted)
                                          ? "linear-gradient(135deg, #0088cc 0%, #24A1DE 100%)"
                                          : "rgba(255, 255, 255, 0.08)",
                                        color: (telegramUsernameInput.trim() && isActionCompleted) ? "#ffffff" : "rgba(255, 255, 255, 0.35)",
                                        border: "none",
                                        cursor: (telegramUsernameInput.trim() && isActionCompleted) ? "pointer" : "not-allowed",
                                        boxShadow: (telegramUsernameInput.trim() && isActionCompleted) ? "0 4px 20px rgba(0, 136, 204, 0.45)" : "none",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        opacity: (telegramUsernameInput.trim() && isActionCompleted) ? 1 : 0.5,
                                        transition: "all 0.25s ease"
                                      }}
                                    >
                                      {claiming
                                        ? "✈️ Checking Telegram Bot..."
                                        : !isActionCompleted
                                          ? "🔒 Complete Step 1 First"
                                          : !telegramUsernameInput.trim()
                                            ? "Enter Username / ID Above"
                                            : "Verify Membership & Claim XP →"}
                                    </button>
                                  </div>
                                </div>
                              ) : (selectedQuest.id === "discord-member" || !!(selectedQuest as any).discord_guild_id || (selectedQuest.title || "").toLowerCase().includes("discord")) ? (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                {selectedQuest.actionUrl && (
                                  <a
                                    href={selectedQuest.actionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      width: "100%",
                                      padding: "12px",
                                      borderRadius: 12,
                                      fontWeight: 700,
                                      fontSize: "0.88rem",
                                      background: "rgba(88, 101, 242, 0.15)",
                                      border: "1px solid rgba(88, 101, 242, 0.4)",
                                      color: "#818cf8",
                                      textDecoration: "none",
                                      textAlign: "center",
                                      display: "block",
                                      boxSizing: "border-box"
                                    }}
                                  >
                                    🔗 Step 1: Join Discord Server First ↗
                                  </a>
                                )}
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
                                    gap: 8
                                  }}
                                >
                                  💬 Step 2: Authorize & Verify Membership →
                                </button>
                              </div>
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

          {/* Leaderboard Alias Name Customization Modal */}
          {showAliasModal && (authenticatedUser || qrPass) && (
            <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.85)", zIndex: 99999 }}>
              <div
                className="modal-content"
                style={{
                  maxWidth: 360,
                  width: "100%",
                  padding: 24,
                  textAlign: "center",
                  background: "#121723",
                  border: "1px solid rgba(245, 166, 35, 0.45)",
                  borderRadius: 18,
                  boxShadow: "0 10px 35px rgba(0,0,0,0.6), 0 0 25px rgba(245,166,35,0.15)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ color: "#fbbf24", margin: 0, fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🛡️</span> Leaderboard Alias
                  </h2>
                  <button
                    onClick={() => {
                      setShowAliasModal(false);
                      setAliasModalError("");
                    }}
                    style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    background: "rgba(245, 166, 35, 0.08)",
                    border: "1px solid rgba(245, 166, 35, 0.25)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 16,
                    textAlign: "left",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255, 255, 255, 0.85)", lineHeight: 1.45 }}>
                    🔒 <strong>Privacy Protection:</strong> Your full name is hidden from public rankings. Choose an alias to represent yourself on the global leaderboard.
                  </p>
                </div>

                <form onSubmit={handleSaveAlias} style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ fontSize: "0.82rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 6 }}>
                    Unique Alias Name *
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: 12, color: "var(--gold-light)", fontWeight: 800, fontSize: "0.95rem" }}>
                        @
                      </span>
                      <input
                        type="text"
                        maxLength={20}
                        required
                        placeholder="e.g. Satoshi_99"
                        value={aliasInput}
                        onChange={(e) => {
                          setAliasInput(e.target.value);
                          if (aliasModalError) setAliasModalError("");
                        }}
                        style={{
                          width: "100%",
                          padding: "11px 12px 11px 28px",
                          borderRadius: 10,
                          background: "#080b12",
                          border: aliasModalError ? "1px solid #f87171" : "1px solid rgba(245,166,35,0.4)",
                          color: "#fff",
                          fontSize: "0.92rem",
                          fontWeight: 700,
                          outline: "none",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                      3-20 characters (letters, numbers, _ or -). Must be unique.
                    </span>
                  </label>

                  {aliasModalError && (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>⚠️</span>
                      <p style={{ color: "#fca5a5", fontSize: "0.78rem", margin: 0, lineHeight: 1.35 }}>
                        {aliasModalError}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={aliasSaving}
                    className="arena-cta-btn"
                    style={{
                      marginTop: 6,
                      padding: "13px",
                      fontSize: "0.92rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {aliasSaving ? (
                      <>⏳ Checking & Saving...</>
                    ) : (
                      <>✓ Save Public Alias</>
                    )}
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

                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "16px", marginBottom: "12px", lineHeight: 1.4 }}>
                  Present this enlarged QR code to the <strong>Gate Staff</strong> or <strong>Sponsor Booths</strong> for instant scanning.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowQrZoomModal(false);
                    setActiveTab("quests");
                  }}
                  style={{
                    marginBottom: "16px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, rgba(245, 166, 35, 0.22) 0%, rgba(217, 119, 6, 0.32) 100%)",
                    border: "1px solid rgba(245, 166, 35, 0.6)",
                    borderRadius: "24px",
                    boxShadow: "0 0 20px rgba(245, 166, 35, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.25s ease"
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>🏆</span>
                  <span style={{
                    color: "#fbbf24",
                    fontWeight: 900,
                    fontSize: "0.88rem",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase"
                  }}>
                    Play Quest & Win a Prize →
                  </span>
                </button>

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

          {/* ── Feedback & Support Ticket Modal ── */}
          <FeedbackTicketModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            defaultEmail={ticketEmail || authenticatedUser?.email || qrPass?.email || ""}
            defaultName={authenticatedUser?.fullName || qrPass?.fullName || ""}
            defaultTicketCode={qrPass?.passCode || authenticatedUser?.ticket_code || ""}
            initialMode={feedbackModalInitialMode}
            onSuccess={(ref) => {
              showNotice(`Your support ticket #${ref} was submitted successfully! Our event admin team will review it.`, "success", "Ticket Submitted");
            }}
          />

          {/* ── Grand Jackpot Fireworks Celebration Overlay ── */}
          {showJackpotFireworks && (
            <div className="jackpot-fireworks-overlay" role="dialog" aria-modal="true" aria-label="Jackpot Celebration">
              {/* Multicolored Skyward Firework Rockets & Bursts */}
              {[
                { startX: "15vw", targetX: "20vw", targetY: "25vh", color: "#facc15", delay: "0s" },
                { startX: "80vw", targetX: "75vw", targetY: "20vh", color: "#38bdf8", delay: "0.25s" },
                { startX: "48vw", targetX: "50vw", targetY: "18vh", color: "#ec4899", delay: "0.45s" },
                { startX: "30vw", targetX: "35vw", targetY: "38vh", color: "#34d399", delay: "0.7s" },
                { startX: "65vw", targetX: "65vw", targetY: "34vh", color: "#f97316", delay: "0.9s" },
                { startX: "22vw", targetX: "28vw", targetY: "22vh", color: "#a855f7", delay: "1.15s" },
                { startX: "78vw", targetX: "72vw", targetY: "26vh", color: "#facc15", delay: "1.35s" },
                { startX: "50vw", targetX: "48vw", targetY: "15vh", color: "#22c55e", delay: "1.6s" },
              ].map((fw, i) => (
                <div
                  key={i}
                  className="firework-rocket"
                  style={{
                    color: fw.color,
                    animationDelay: fw.delay,
                    ["--startX" as any]: fw.startX,
                    ["--targetX" as any]: fw.targetX,
                    ["--targetY" as any]: fw.targetY,
                  }}
                />
              ))}

              <div className="jackpot-banner">
                <span className="jackpot-banner__crown">👑</span>
                <h1 className="jackpot-banner__title">🎆 JACKPOT! 🎆</h1>
                <span className="jackpot-banner__sub">🌟 +100 XP WON! 🌟</span>
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
