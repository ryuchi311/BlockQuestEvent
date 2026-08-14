"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function Home() {
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!portalRef.current) return;
      const cards = portalRef.current.querySelectorAll(".choice-card");
      cards.forEach((card: any) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <main className="home-page">
      <section className="home-shell" ref={portalRef}>
        <header className="home-header">
          <div className="home-brand-row">
            <img
              className="home-logo"
              src="https://block-quest.com/assets/images/block_quest_logo.png"
              alt="BlockQuest Fiesta Official Logo"
            />
            <div className="home-brand-copy">
              <span className="eyebrow-link">✦ Choose Your Portal ✦</span>
              <h1>BlockQuest Fiesta PH</h1>
              <p>
                Experience Manila's premier Web3 developer summit. Claim your official event pass or jump straight into the interactive quester community app.
              </p>
              <a
                className="home-hero-link"
                href="https://block-quest.com/"
                target="_blank"
                rel="noreferrer"
              >
                BlockQuest Fiesta PH — Oct 2026 | Let the Quest Begin!
              </a>
            </div>
          </div>
        </header>

        <div className="home-choices">
          {/* Card 1: Event Ticket Desk */}
          <Link href="/register" className="choice-card choice-card--primary">
            <div className="choice-icon">🎫</div>
            <div>
              <h2>Get Your Event Pass</h2>
              <p>
                Register your account, secure your attendee spot, and generate your secure QR entry pass.
              </p>
            </div>
            <span className="choice-btn">
              Get Free Ticket →
            </span>
          </Link>

          {/* Card 2: BlockQuest Game */}
          <Link href="/zealy" className="choice-card choice-card--secondary">
            <div className="choice-icon">⚡</div>
            <div>
              <h2>BlockQuest Game</h2>
              <p>
                Complete live quests, climb the leaderboard, level up, and unlock rewards in our mobile-first interactive game.
              </p>
            </div>
            <span className="choice-btn">
              Play BlockQuest Game →
            </span>
          </Link>
        </div>
        <div style={{ textAlign: "center", marginTop: "32px", display: "flex", justifyContent: "center" }}>
          <Link
            href="/shortcut"
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              textDecoration: "none",
              letterSpacing: "0.06em",
              opacity: 0.6,
              transition: "opacity 0.2s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "0.6")}
          >
            🧭 Shortcut
          </Link>
        </div>

        <footer className="home-footer">
          <span className="home-footer__meta">© 2026 BlockQuest. All Rights Reserved.</span>
          <span className="home-footer__meta home-footer__meta--love">Made with ❤️ for the community</span>
        </footer>
      </section>
    </main>
  );
}
