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

const initialLeaderboard = [
  { rank: 1, name: "Jasper Cruz", points: 1280, change: "+120", accent: "leaderboard-item--gold" },
  { rank: 2, name: "Mika Santos", points: 1165, change: "+88", accent: "leaderboard-item--silver" },
  { rank: 3, name: "Nina Reyes", points: 1090, change: "+54", accent: "leaderboard-item--bronze" },
  { rank: 4, name: "Ari Dela Vega", points: 960, change: "+42" },
  { rank: 5, name: "Kai Mercado", points: 910, change: "+31" },
];

export default function ZealyMobileApp() {
  const [activeTab, setActiveTab] = useState<"quests" | "leaderboard" | "info" | "profile">("quests");
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [userXp, setUserXp] = useState(150);
  const [userRank, setUserRank] = useState(12);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);

  // Load ticket if user was registered/logged in in this session
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketPassword, setTicketPassword] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [qrPass, setQrPass] = useState<any>(null);
  const [ticketError, setTicketError] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);

  const userLevel = Math.floor(userXp / 300) + 1;
  const xpInCurrentLevel = userXp % 300;
  const xpProgressPercentage = Math.min(100, Math.floor((xpInCurrentLevel / 300) * 100));

  // Dynamically sync quests from API
  useEffect(() => {
    async function loadApiQuests() {
      try {
        const res = await fetch("/api/admin/quests");
        const json = await res.json();
        if (res.ok && Array.isArray(json.quests) && json.quests.length > 0) {
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
          setQuests(mappedQuests);
        }
      } catch {
        // Fallback to initialQuests
      }
    }
    loadApiQuests();
  }, []);

  const handleQuestClick = (quest: Quest) => {
    if (quest.status === "Soon") return;
    setSelectedQuest(quest);
  };

  const handleProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
          user_name: authenticatedUser?.full_name || qrPass?.fullName || "Registered Quester",
          user_email: ticketEmail || "quester@blockquest.ph",
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
    if (!ticketEmail) {
      setTicketError("Please enter your ticket email.");
      return;
    }
    setTicketLoading(true);
    setTicketError("");
    try {
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ticketEmail, password: ticketPassword }),
      });
      const loginResult = await loginResponse.json();
      if (!loginResponse.ok || !loginResult?.fullName || !loginResult.email) {
        setTicketError(loginResult?.error ?? "Ticket lookup failed.");
        setTicketLoading(false);
        return;
      }
      const qrResponse = await fetch("/api/qr-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ticketEmail, password: ticketPassword }),
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

  return (
    <main className="zealy-page">
      <div className="mobile-shell">
        <div className="mobile-screen">
          <div className="app-header">
            <div className="app-header__brand">
              <img
                src="https://block-quest.com/assets/images/block_quest_logo.png"
                alt="BlockQuest Logo"
                style={{ width: "32px", height: "32px", objectFit: "contain" }}
              />
              <div>
                <p className="app-header__eyebrow">Fiesta Quest Game</p>
                <h1 className="app-header__title">BlockQuest Arena</h1>
              </div>
            </div>
            <div className="app-header__level">
              Level {userLevel}
            </div>
          </div>
          <div className="xp-card">
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
          <div className="app-content-scroll">
            {activeTab === "quests" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Available tasks</p>
                    <h2>Fiesta Event Quests</h2>
                  </div>
                </div>
                <div className="quest-list">
                  {quests.map((q) => (
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
                        <p className="quest-card__desc">{q.description}</p>
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
                </div>
              </div>
            )}
            {activeTab === "leaderboard" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Real-time stats</p>
                    <h2>Leaderboard</h2>
                  </div>
                </div>
                <div className="leaderboard-list">
                  {leaderboard.map((item) => (
                    <div
                      key={item.rank}
                      className={`leaderboard-item ${item.accent ?? ""}`}
                    >
                      <div className="leaderboard-item__rank">#{item.rank}</div>
                      <div className="leaderboard-item__info">
                        <strong>{item.name}</strong>
                        <span>{item.points} XP</span>
                      </div>
                      <div className="leaderboard-item__change">{item.change}</div>
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
                  <p>Grand Ballroom, Okada Manila, Pasay City, Philippines</p>
                </article>
                <article className="info-card">
                  <h3>🗓️ Date & Time</h3>
                  <p>Saturday, October 17, 2026 • 9:00 AM – 6:00 PM PHT</p>
                </article>
                <article className="info-card">
                  <h3>⚡ Event Highlights</h3>
                  <p style={{ marginBottom: "6px" }}>• <strong>Keynotes:</strong> Global Web3 builders & founders.</p>
                  <p style={{ marginBottom: "6px" }}>• <strong>Web3 Gaming Arena:</strong> Live tournaments and presentations.</p>
                  <p>• <strong>Hacker Hub:</strong> Code and pitch panels.</p>
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
                      Enter your registration email to link your ticket pass and claim +250 XP instantly!
                    </p>
                    <form className="form" onSubmit={handleLinkTicket}>
                      <label style={{ gap: "4px" }}>
                        Email
                        <input
                          type="email"
                          value={ticketEmail}
                          onChange={(e) => setTicketEmail(e.target.value)}
                          placeholder="mara@studio.com"
                          required
                          style={{ padding: "10px 12px", fontSize: "0.85rem" }}
                        />
                      </label>
                      {ticketError && (
                        <p style={{ color: "#f87171", fontSize: "0.78rem", margin: "4px 0" }}>
                          {ticketError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={ticketLoading}
                        style={{ padding: "12px", fontSize: "0.9rem" }}
                      >
                        {ticketLoading ? "Verifying..." : "Link Ticket & Claim XP"}
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
                    <strong style={{ fontSize: "1.2rem", color: "#gold-light" }}>#{userRank}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
          <nav className="app-tabs">
            <button
              onClick={() => setActiveTab("quests")}
              className={`tab-btn ${activeTab === "quests" ? "tab-btn--active" : ""}`}
            >
              <span>🎯</span> Quests
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`tab-btn ${activeTab === "leaderboard" ? "tab-btn--active" : ""}`}
            >
              <span>🏆</span> Rank
            </button>
            <button
              onClick={() => setActiveTab("info")}
              className={`tab-btn ${activeTab === "info" ? "tab-btn--active" : ""}`}
            >
              <span>ℹ️</span> Info
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`tab-btn ${activeTab === "profile" ? "tab-btn--active" : ""}`}
            >
              <span>👤</span> Profile
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
                <p className="modal-body">{selectedQuest.description}</p>
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
                    {selectedQuest.actionUrl && (
                      <Link
                        href={selectedQuest.actionUrl}
                        target={selectedQuest.actionUrl.startsWith("http") ? "_blank" : undefined}
                        className="modal-action-btn"
                        style={{ textAlign: "center", marginBottom: 12 }}
                        onClick={() => {
                          if (selectedQuest.id === "register") {
                            setSelectedQuest(null);
                            setActiveTab("profile");
                          }
                        }}
                      >
                        {selectedQuest.actionLabel ?? "Visit Link"}
                      </Link>
                    )}
                    {selectedQuest.requiresProof ? (
                      <div style={{ marginTop: 12, marginBottom: 16, background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--gold-light)", display: "block", marginBottom: 8 }}>
                          📷 Upload Proof Screenshot Required:
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofImageChange}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(0,0,0,0.4)",
                            color: "#fff",
                            fontSize: "0.82rem",
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
                          disabled={proofSubmitting || !proofImage}
                          className="modal-claim-btn"
                          style={{
                            marginTop: 14,
                            background: proofImage ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" : "rgba(255,255,255,0.1)",
                            opacity: proofImage ? 1 : 0.6,
                            cursor: proofImage ? "pointer" : "not-allowed",
                          }}
                        >
                          {proofSubmitting ? "Submitting Proof..." : "📤 Submit Screenshot for Verification"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimXp}
                        disabled={claiming}
                        className="modal-claim-btn"
                      >
                        {claiming ? "Claiming..." : "Claim XP Reward"}
                      </button>
                    )}
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
