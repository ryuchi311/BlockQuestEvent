"use client";

import RegistrationForm from "../../components/registration-form";
import Link from "next/link";
import Footer from "../../components/footer";

export default function RegisterPage() {
  return (
    <main className="registration-page">
      <section className="registration-shell">
        <header className="registration-hero">
          <span className="eyebrow-link">✦ Registration portal ✦</span>
          <h1>BlockQuest Fiesta PH</h1>
          <p>
            Secure your spot today. Once registered, log in to immediately generate your secure QR Pass ticket for entrance access.
          </p>

          <div className="event-specs">
            <div className="spec-item">
              <span className="spec-icon">📅</span>
              <div className="spec-info">
                <h3>Date</h3>
                <p suppressHydrationWarning>10 October 2026</p>
              </div>
            </div>
            <div className="spec-item">
              <span className="spec-icon">📍</span>
              <div className="spec-info">
                <h3>Venue</h3>
                <p>CABS Cabuyao City, Laguna, Philippines</p>
              </div>
            </div>
            <div className="spec-item">
              <span className="spec-icon">🎟️</span>
              <div className="spec-info">
                <h3>Access</h3>
                <p>Free Ticket</p>
              </div>
            </div>
            <div className="spec-item">
              <span className="spec-icon">⚡</span>
              <div className="spec-info">
                <h3>Rewards</h3>
                <p>+250 XP in Quest Line</p>
              </div>
            </div>
          </div>

          <div className="registration-hero__links">
            <Link className="hero-link" href="/zealy">
              Go to BlockQuest Game
            </Link>
            <Link className="hero-link hero-link--ghost" href="/">
              Home Portal
            </Link>
          </div>
        </header>

        <section className="app-card form-card" aria-labelledby="register-title">
          <div className="section-head">
            <div>
              <p className="section-head__eyebrow">Ticket booth</p>
              <h2 id="register-title">Register & Claim Ticket</h2>
            </div>
            <span className="section-head__meta">Free Pass</span>
          </div>
          <RegistrationForm />
        </section>
        
        <Footer />
      </section>
    </main>
  );
}
