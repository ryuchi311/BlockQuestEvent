"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  status: "Live" | "Soon" | "Done";
  category: "onboarding" | "social" | "daily";
  actionLabel?: string;
  actionUrl?: string;
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
    description: "Follow our official X handle to stay updated with real-time event updates and announcements.",
    xp: 100,
    status: "Live",
    category: "social",
    actionLabel: "Follow on X",
    actionUrl: "https://x.com"
  },
  {
    id: "join-tg",
    title: "Join BlockQuest PH Telegram",
    description: "Connect with fellow developers, speakers, and partners in our official telegram group.",
    xp: 100,
    status: "Live",
    category: "social",
    actionLabel: "Join group",
    actionUrl: "https://t.me"
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

  const handleQuestClick = (quest: Quest) => {
    if (quest.status === "Soon") return;
    setSelectedQuest(quest);
  };

  const handleClaimXp = () => {
    if (!selectedQuest) return;
    setClaiming(true);
    setTimeout(() => {
      // Add XP
      setUserXp((prev) => prev + selectedQuest.xp);
      
      // Update quest status to done
      setQuests((prevQuests) =>
        prevQuests.map((q) => (q.id === selectedQuest.id ? { ...q, status: "Done" } : q))
      );

      // Add user to leaderboard if they complete a high XP quest
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

      // Generate QR Pass
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

      // Reward points for linking ticket
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
      <div className="mobile-simulator">
        <div className="mobile-app">
          {/* Header Banner */}
          <header className="app-header-container">
            <div className="app-banner" />
            <div className="app-header__community">
              <div className="app-logo__wrapper">
                <img
                  src="https://block-quest.com/assets/images/block_quest_logo.png"
                  alt="BlockQuest Logo"
                />
              </div>
              <div className="app-header__text">
                <h1>BlockQuest Fiesta PH</h1>
                <p>Oct 17, 2026 • Manila</p>
              </div>
            </div>
          </header>

          {/* Viewport for changing tabs */}
          <div className="app-viewport">
            
            {/* User XP Progression Bar (Always shown at the top of the feed) */}
            <section className="user-progress-bar">
              <div className="progress-info">
                <span className="level-badge">Level {userLevel}</span>
                <span className="xp-fraction">{xpInCurrentLevel}/300 XP</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${xpProgressPercentage}%` }} />
              </div>
            </section>

            {/* TAB CONTENT: QUESTS */}
            {activeTab === "quests" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Available Quests</p>
                    <h2>Fiesta Event Quests</h2>
                  </div>
                  <span className="section-head__meta">Live</span>
                </div>

                <div className="quest-category">
                  <h3 className="quest-category__title">Onboarding</h3>
                  <div className="quest-grid">
                    {quests
                      .filter((q) => q.category === "onboarding")
                      .map((quest) => (
                        <article
                          key={quest.id}
                          className="quest-tile"
                          onClick={() => handleQuestClick(quest)}
                          style={{ opacity: quest.status === "Soon" ? 0.6 : 1 }}
                        >
                          <div>
                            <h3>{quest.title}</h3>
                            <p>+{quest.xp} XP</p>
                          </div>
                          <span
                            className={`quest-status-badge quest-status--${quest.status.toLowerCase()}`}
                          >
                            {quest.status}
                          </span>
                        </article>
                      ))}
                  </div>
                </div>

                <div className="quest-category">
                  <h3 className="quest-category__title">Socials</h3>
                  <div className="quest-grid">
                    {quests
                      .filter((q) => q.category === "social")
                      .map((quest) => (
                        <article
                          key={quest.id}
                          className="quest-tile"
                          onClick={() => handleQuestClick(quest)}
                        >
                          <div>
                            <h3>{quest.title}</h3>
                            <p>+{quest.xp} XP</p>
                          </div>
                          <span
                            className={`quest-status-badge quest-status--${quest.status.toLowerCase()}`}
                          >
                            {quest.status}
                          </span>
                        </article>
                      ))}
                  </div>
                </div>

                <div className="quest-category">
                  <h3 className="quest-category__title">Daily</h3>
                  <div className="quest-grid">
                    {quests
                      .filter((q) => q.category === "daily")
                      .map((quest) => (
                        <article
                          key={quest.id}
                          className="quest-tile"
                          onClick={() => handleQuestClick(quest)}
                        >
                          <div>
                            <h3>{quest.title}</h3>
                            <p>+{quest.xp} XP</p>
                          </div>
                          <span
                            className={`quest-status-badge quest-status--${quest.status.toLowerCase()}`}
                          >
                            {quest.status}
                          </span>
                        </article>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: LEADERBOARD */}
            {activeTab === "leaderboard" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Rankings</p>
                    <h2>Community Leaderboard</h2>
                  </div>
                  <span className="section-head__meta">Rank #{userRank}</span>
                </div>

                <ul className="leaderboard-list">
                  {leaderboard.map((entry) => (
                    <li
                      key={entry.rank}
                      className={`leaderboard-item ${entry.accent ?? ""}`}
                    >
                      <span className="leaderboard-item__rank">{entry.rank}</span>
                      <div className="leaderboard-item__info">
                        <div className="leaderboard-item__name">{entry.name}</div>
                        <span className="leaderboard-item__change">{entry.change}</span>
                      </div>
                      <span className="leaderboard-item__xp">{entry.points} XP</span>
                    </li>
                  ))}

                  {/* Render Current User ranking in-place if they haven't reached top 5 */}
                  {userRank > 5 && (
                    <li className="leaderboard-item" style={{ borderLeft: "3px solid var(--gold)" }}>
                      <span className="leaderboard-item__rank" style={{ background: "rgba(245, 166, 35, 0.15)", color: "var(--gold)" }}>
                        {userRank}
                      </span>
                      <div className="leaderboard-item__info">
                        <div className="leaderboard-item__name">You (Player)</div>
                        <span className="leaderboard-item__change">+150</span>
                      </div>
                      <span className="leaderboard-item__xp">{userXp} XP</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* TAB CONTENT: EVENT INFO */}
            {activeTab === "info" && (
              <div className="zealy-tab-content">
                <div className="section-head">
                  <div>
                    <p className="section-head__eyebrow">Event Details</p>
                    <h2>Event Guide</h2>
                  </div>
                </div>

                <article className="info-card">
                  <h3>Saturday, 17 Oct 2026</h3>
                  <p>09:00 - 18:30 GMT+8</p>
                  <p style={{ marginTop: "4px", fontSize: "0.78rem" }}>Doors open at 08:30. Arrive early to scan your tickets and grab swags.</p>
                </article>

                <article className="info-card">
                  <h3>Manila, Philippines</h3>
                  <p>Grand Ballroom, Conrad Manila</p>
                </article>

                <article className="info-card">
                  <h3>Stages & Highlights</h3>
                  <p style={{ marginBottom: "6px" }}>• <strong>DeFi Stage:</strong> Keynotes on decentralized ecosystems.</p>
                  <p style={{ marginBottom: "6px" }}>• <strong>Web3 Gaming Arena:</strong> Live tournaments and presentations.</p>
                  <p>• <strong>Hacker Hub:</strong> Code and pitch panels.</p>
                </article>

                <div style={{ textAlign: "center", marginTop: "10px" }}>
                  <Link href="/register" className="hero-link" style={{ width: "100%", padding: "12px" }}>
                    Go to Ticket Desk
                  </Link>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PROFILE & INTEGRATION */}
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
                        <div className="qr-pass__logo-overlay" style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px"
                        }}>
                          <img src="/logo.png" alt="BlockQuest Logo" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
                        </div>
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
                    <strong style={{ fontSize: "1.2rem", color: "var(--gold-light)" }}>#{userRank}</strong>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Navigation Bar */}
          <nav className="app-tabs">
            <button
              onClick={() => setActiveTab("quests")}
              className={`tab-btn ${activeTab === "quests" ? "tab-btn--active" : ""}`}
            >
              <span className="tab-icon">🎯</span>
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

          {/* Interactive Quest claim Modal overlay */}
          {selectedQuest && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>{selectedQuest.title}</h2>
                  <button
                    className="modal-close-btn"
                    onClick={() => setSelectedQuest(null)}
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
                ) : (
                  <>
                    {selectedQuest.actionUrl && (
                      <Link
                        href={selectedQuest.actionUrl}
                        target={selectedQuest.actionUrl.startsWith("http") ? "_blank" : undefined}
                        className="modal-action-btn"
                        style={{ textAlign: "center" }}
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
                    <button
                      onClick={handleClaimXp}
                      disabled={claiming}
                      className="modal-claim-btn"
                    >
                      {claiming ? "Claiming..." : "Claim XP Reward"}
                    </button>
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
