"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  status: "Live" | "Soon" | "Done" | "Pending Verification";
  category: "onboarding" | "social" | "daily";
  actionLabel?: string;
  actionUrl?: string;
  requiresProof?: boolean;
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
    description: "Scan your QR pass at the entrance gate on Saturday, Oct 17 to claim this XP reward.",
    xp: 500,
    status: "Soon",
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
    id: "daily-claim",
    title: "Daily Check-in",
    description: "Claim your daily check-in points to boost your leaderboard ranking.",
    xp: 50,
    status: "Live",
    category: "daily"
  }
];

const initialLeaderboard: { rank: number; name: string; points: number; change: string; accent?: string }[] = [];

export default function ZealyMobileApp() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"quests" | "leaderboard" | "info" | "profile">("quests");
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [userXp, setUserXp] = useState(0);
  const [userRank, setUserRank] = useState(12);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [visitedActions, setVisitedActions] = useState<Record<string, boolean>>({});
  const [userVerifications, setUserVerifications] = useState<any[]>([]);
  const [showCompletedQuests, setShowCompletedQuests] = useState(false);

  // Load ticket if user was registered/logged in in this session
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketCountryCode, setTicketCountryCode] = useState("+63");
  const [ticketMobileNum, setTicketMobileNum] = useState("");
  const [ticketPassword, setTicketPassword] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [qrPass, setQrPass] = useState<any>(null);
  const [ticketError, setTicketError] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);

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

  function handleLogout() {
    setAuthenticatedUser(null);
    setQrPass(null);
    setTicketEmail("");
    setTicketMobileNum("");
    setTicketCountryCode("+63");
    setTicketError("");
    setUserXp(0);
    setUserRank(12);
    setQuests(initialQuests);
    setActiveTab("quests");
  }

  const [newQuestAlert, setNewQuestAlert] = useState<{ count: number; questTitle: string } | null>(null);
  const previousQuestsCountRef = React.useRef<number | null>(null);

  // Dynamically sync quests from API
  const loadApiQuests = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quests");
      const json = await res.json();
      if (res.ok && Array.isArray(json.quests)) {
        const mappedQuests: Quest[] = json.quests.map((q: any) => ({
          id: q.id,
          title: q.title,
          description: q.description || "",
          xp: q.xp || 100,
          status: q.status || "Soon",
          category: q.category || "onboarding",
          actionLabel: q.action_label || undefined,
          actionUrl: q.action_url || undefined,
          requiresProof: !!q.requires_proof,
        }));

        // Detect if new quests were published by admin
        if (previousQuestsCountRef.current !== null && mappedQuests.length > previousQuestsCountRef.current) {
          const diff = mappedQuests.length - previousQuestsCountRef.current;
          const latestQuest = mappedQuests[mappedQuests.length - 1];
          setNewQuestAlert({ count: diff, questTitle: latestQuest.title });
        }
        previousQuestsCountRef.current = mappedQuests.length;
        setQuests(mappedQuests);
      }
    } catch {
      // Fallback to initialQuests
    }
  }, []);

  // Poll for new quests in background every 12 seconds
  useEffect(() => {
    loadApiQuests();
    const interval = setInterval(() => {
      loadApiQuests();
    }, 12000);
    return () => clearInterval(interval);
  }, [loadApiQuests]);

  const handleQuestClick = (quest: Quest) => {
    if (quest.status === "Soon") return;
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

  const fetchUserVerifications = React.useCallback(async () => {
    const email = ticketEmail || authenticatedUser?.email || qrPass?.email;
    if (!email) return;
    try {
      const res = await fetch(`/api/admin/verifications?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.verifications)) {
        setUserVerifications(json.verifications);
      }
    } catch {
      // ignore
    }
  }, [ticketEmail, authenticatedUser, qrPass]);

  useEffect(() => {
    fetchUserVerifications();
  }, [fetchUserVerifications, activeTab]);

  const handleSubmitProof = async () => {
    if (!selectedQuest || !proofImage) return;
    setProofSubmitting(true);
    try {
      await fetch("/api/admin/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quest_id: selectedQuest.id,
          quest_title: selectedQuest.title,
          user_name: authenticatedUser?.fullName || qrPass?.fullName || "Registered Quester",
          user_email: ticketEmail || authenticatedUser?.email || "quester@blockquest.ph",
          ticket_code: qrPass?.passCode || "BQF-GUEST",
          xp: selectedQuest.xp,
          proof_url: proofImage,
        }),
      });
      setQuests((prev) =>
        prev.map((q) => (q.id === selectedQuest.id ? { ...q, status: "Pending Verification" } : q))
      );
      setSelectedQuest(null);
      setProofImage(null);
      fetchUserVerifications();
    } catch {
      alert("Submission error. Please try again.");
    } finally {
      setProofSubmitting(false);
    }
  };

  const handleClaimXp = () => {
    if (!selectedQuest) return;
    setClaiming(true);
    setTimeout(() => {
      setUserXp((prev) => prev + selectedQuest.xp);
      setQuests((prevQuests) =>
        prevQuests.map((q) => (q.id === selectedQuest.id ? { ...q, status: "Done" } : q))
      );
      if (selectedQuest.id === "register" || selectedQuest.id === "checkin") {
        setUserRank(6);
      }
      setClaiming(false);
      setSelectedQuest(null);
    }, 1200);
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
        body: JSON.stringify({ email: ticketEmail.trim(), phone: fullPhone, password: ticketPassword }),
      });
      const loginResult = await loginResponse.json();
      if (!loginResponse.ok || !loginResult?.fullName || !loginResult.email) {
        setTicketError(loginResult?.error ?? "No matching ticket found with this email and phone.");
        setTicketLoading(false);
        return;
      }
      const qrResponse = await fetch("/api/qr-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ticketEmail.trim(), password: ticketPassword }),
      });
      const qrResult = await qrResponse.json();
      if (!qrResponse.ok || !qrResult?.qrDataUrl || !qrResult.passCode) {
        setTicketError("Failed to fetch ticket credentials.");
        setTicketLoading(false);
        return;
      }
      setAuthenticatedUser({
        fullName: loginResult.fullName,
        email: loginResult.email,
      });
      setQrPass({
        fullName: qrResult.fullName ?? loginResult.fullName,
        email: qrResult.email ?? loginResult.email,
        passCode: qrResult.passCode,
        qrDataUrl: qrResult.qrDataUrl,
      });
      setQuests((prevQuests) =>
        prevQuests.map((q) => (q.id === "register" ? { ...q, status: "Done" } : q))
      );
      setUserXp((prev) => prev + 250);
      setUserRank(6);
    } catch (err) {
      setTicketError("Connection error. Please try again.");
    } finally {
      setTicketLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="zealy-page">
      <div className="mobile-simulator">
        <div className="mobile-app">
          {/* Header */}
          <header className="zealy-header">
            <div className="zealy-header__brand">
              <div className="zealy-logo-box">
                <img
                  src="https://block-quest.com/assets/images/block_quest_logo.png"
                  alt="BlockQuest Logo"
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
            {activeTab !== "profile" && activeTab !== "info" && (
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
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Available tasks</p>
                    <h2>Fiesta Event Quests</h2>
                  </div>
                </div>

                {!authenticatedUser && !qrPass ? (
                  <div className="login-card" style={{ marginTop: 8, padding: "20px 18px", textAlign: "center", border: "1px solid rgba(245, 166, 35, 0.4)", background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(35, 25, 15, 0.95) 100%)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 6 }}>🔒</div>
                    <h3 style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1.1rem", marginBottom: 6 }}>
                      Login Required to Play
                    </h3>
                    <p className="login-card__hint" style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 16 }}>
                      Enter your registered Email & Phone Number to log into BlockQuest Arena, link your event ticket pass, and claim <strong>+250 XP</strong>!
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
                        {ticketLoading ? "Verifying Account..." : "⚡ Login & Unlock Quests (+250 XP)"}
                      </button>
                    </form>
                    <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.4)", marginTop: 14 }}>
                      Don't have a ticket yet? <Link href="/register" style={{ color: "#fbbf24", textDecoration: "underline" }}>Register Here</Link>
                    </p>
                  </div>
                ) : (
                  <div className="quest-list">
                    {/* Active / In Progress Quests */}
                    <div className="quest-category__title">
                      <span>⚡ Active Quests ({quests.filter((q) => q.status === "Live" || q.status === "Soon").length})</span>
                    </div>

                    {quests.filter((q) => q.status === "Live" || q.status === "Soon").map((q) => (
                      <div
                        key={q.id}
                        className={`quest-card quest-card--${q.status.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => handleQuestClick(q)}
                      >
                        <div className="quest-card__body">
                          <div className="quest-card__meta">
                            <span className={`category-badge category-badge--${q.category}`}>
                              {q.category}
                            </span>
                            <span className="xp-badge">+{q.xp} XP</span>
                            {q.requiresProof && (
                              <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "10px", background: "rgba(139, 92, 246, 0.2)", color: "#a78bfa", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
                                📷 Proof Required
                              </span>
                            )}
                          </div>
                          <h3 className="quest-card__title">{q.title}</h3>
                          <p className="quest-card__desc" style={{ whiteSpace: "pre-wrap" }}>{q.description}</p>
                        </div>
                        <div className="quest-card__footer">
                          <span className={`status-badge status-badge--${q.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {q.status}
                          </span>
                          {q.status !== "Soon" && q.status !== "Done" && q.status !== "Pending Verification" && (
                            <span className="quest-card__arrow">→</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Completed Quests Toggle Section */}
                    {quests.filter((q) => q.status === "Done" || q.status === "Pending Verification").length > 0 && (
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
                            ✅ Completed Quests ({quests.filter((q) => q.status === "Done" || q.status === "Pending Verification").length})
                          </span>
                          <span style={{ color: "var(--gold-light)", fontWeight: 800, fontSize: "0.85rem" }}>
                            {showCompletedQuests ? "Hide ▴" : "Show ▾"}
                          </span>
                        </button>

                        {showCompletedQuests && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                            {quests.filter((q) => q.status === "Done" || q.status === "Pending Verification").map((q) => (
                              <div
                                key={q.id}
                                className={`quest-card quest-card--${q.status.toLowerCase().replace(/\s+/g, "-")}`}
                                onClick={() => handleQuestClick(q)}
                                style={{ opacity: 0.82, background: "rgba(15, 15, 25, 0.55)", borderColor: "rgba(255, 255, 255, 0.05)" }}
                              >
                                <div className="quest-card__body">
                                  <div className="quest-card__meta">
                                    <span className={`category-badge category-badge--${q.category}`}>
                                      {q.category}
                                    </span>
                                    <span className="xp-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)", boxShadow: "none" }}>
                                      +{q.xp} XP Claimed
                                    </span>
                                  </div>
                                  <h3 className="quest-card__title" style={{ textDecoration: q.status === "Done" ? "line-through" : "none", color: "var(--text-secondary)" }}>
                                    {q.title}
                                  </h3>
                                  <p className="quest-card__desc" style={{ whiteSpace: "pre-wrap" }}>{q.description}</p>
                                </div>
                                <div className="quest-card__footer">
                                  <span className={`status-badge status-badge--${q.status.toLowerCase().replace(/\s+/g, "-")}`}>
                                    {q.status === "Done" ? "✓ Completed" : "⏳ Pending Review"}
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
                  {leaderboard.map((item) => (
                    <div
                      key={item.rank}
                      className={`leaderboard-item ${item.accent ?? ""}`}
                    >
                      <div className="leaderboard-item__rank">#{item.rank}</div>
                      <div className="leaderboard-item__info">
                        <div className="leaderboard-item__name">{item.name}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Rank #{item.rank}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <div className="leaderboard-item__xp">{item.points} XP</div>
                        <div className="leaderboard-item__change">{item.change}</div>
                      </div>
                    </div>
                  ))}
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
                  <p>Saturday, October 17, 2026 • 8:00 AM – 7:30 PM PHT</p>
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
                    <div className="qr-pass__body" style={{ gridTemplateColumns: "110px 1fr" }}>
                      <div style={{ position: "relative", display: "inline-block", width: "110px", height: "110px" }}>
                        <img
                          className="qr-pass__image"
                          src={qrPass.qrDataUrl}
                          alt="Ticket Pass"
                          style={{ width: "110px", height: "110px" }}
                        />
                      </div>
                      <div className="qr-pass__meta">
                        <strong style={{ fontSize: "1rem" }}>Entry QR Pass</strong>
                        <p style={{ fontSize: "0.78rem" }}>{qrPass.email}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--gold-light)" }}>✓ Ticket Linked & XP rewarded (+250 XP)</p>
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

                  {userVerifications.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "4px 0" }}>
                      No quest proof submissions yet. Complete proof-required quests to track verification status here!
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {userVerifications.map((v) => (
                        <div
                          key={v.id}
                          style={{
                            background: "rgba(12, 12, 22, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: 12,
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <strong style={{ fontSize: "0.88rem", color: "#fff", display: "block" }}>{v.quest_title}</strong>
                              <span style={{ fontSize: "0.72rem", color: "var(--gold-light)" }}>+{v.xp} XP Reward</span>
                            </div>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: 10,
                                background:
                                  v.status === "Approved"
                                    ? "rgba(16, 185, 129, 0.18)"
                                    : v.status === "Rejected"
                                    ? "rgba(239, 68, 68, 0.18)"
                                    : "rgba(245, 158, 11, 0.18)",
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
                              }}
                            >
                              {v.status === "Approved" ? "✓ Approved" : v.status === "Rejected" ? "✕ Rejected" : "⏳ Pending Review"}
                            </span>
                          </div>

                          {v.status === "Rejected" && (
                            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 8, padding: 8 }}>
                              <p style={{ fontSize: "0.75rem", color: "#f87171", margin: 0, fontWeight: 600 }}>
                                🔴 <strong>Reason:</strong> {v.rejection_reason || "Proof did not satisfy requirements."}
                              </p>
                              <button
                                onClick={() => {
                                  const questToRetry = quests.find((q) => q.id === v.quest_id) || {
                                    id: v.quest_id,
                                    title: v.quest_title,
                                    description: "Resubmit proof screenshot for admin verification.",
                                    xp: v.xp,
                                    status: "Live" as const,
                                    category: "social" as const,
                                    requiresProof: true,
                                  };
                                  setSelectedQuest(questToRetry as any);
                                  setActiveTab("quests");
                                }}
                                style={{
                                  marginTop: 8,
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: 8,
                                  border: "1px solid rgba(245, 166, 35, 0.5)",
                                  background: "linear-gradient(135deg, #f5a623 0%, #d97706 100%)",
                                  color: "#100b02",
                                  fontSize: "0.78rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                🔄 Try Again & Resubmit Proof
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {qrPass && (
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
                      marginTop: 4,
                      fontFamily: "inherit",
                    }}
                  >
                    🔓 Logout / Switch Account
                  </button>
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
                {newQuestAlert && (
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
          {selectedQuest && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>{selectedQuest.title}</h2>
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
                <div className="modal-xp-reward">Reward: {selectedQuest.xp} XP</div>
                <p className="modal-body" style={{ whiteSpace: "pre-wrap" }}>{selectedQuest.description}</p>
                {selectedQuest.status === "Done" ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      borderRadius: "12px",
                      fontWeight: 800,
                    }}
                  >
                    ✓ Quest Completed!
                  </div>
                ) : selectedQuest.status === "Pending Verification" ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "14px",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "12px",
                      fontWeight: 700,
                    }}
                  >
                    ⏳ Proof Submitted! Awaiting Admin Verification.
                  </div>
                ) : (
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

                          {selectedQuest.requiresProof ? (
                            <div style={{ marginTop: 8, marginBottom: 16, background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                              <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--gold-light)", display: "block", marginBottom: 8 }}>
                                📷 Upload Proof Screenshot Required:
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleProofImageChange}
                                disabled={!isActionCompleted}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  background: "rgba(0,0,0,0.4)",
                                  color: "#fff",
                                  fontSize: "0.82rem",
                                  opacity: isActionCompleted ? 1 : 0.5,
                                }}
                              />
                              {proofImage && (
                                <div style={{ marginTop: 12, textAlign: "center" }}>
                                  <p style={{ fontSize: "0.72rem", color: "#a1a1aa", marginBottom: 6 }}>Proof Screenshot Preview:</p>
                                  <img
                                    src={proofImage}
                                    alt="Screenshot Proof Preview"
                                    style={{ maxHeight: 150, maxWidth: "100%", borderRadius: 8, border: "1px solid rgba(245,166,35,0.4)" }}
                                  />
                                </div>
                              )}
                              <button
                                onClick={handleSubmitProof}
                                disabled={proofSubmitting || !proofImage || !isActionCompleted}
                                className="modal-claim-btn"
                                style={{
                                  marginTop: 14,
                                  background: (proofImage && isActionCompleted) ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" : "rgba(255,255,255,0.1)",
                                  opacity: (proofImage && isActionCompleted) ? 1 : 0.5,
                                  cursor: (proofImage && isActionCompleted) ? "pointer" : "not-allowed",
                                }}
                              >
                                {proofSubmitting ? "Submitting Proof..." : "📤 Submit Screenshot for Verification"}
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
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
