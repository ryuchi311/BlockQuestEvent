"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";

type Status = {
  type: "idle" | "success" | "error";
  message: string;
};

type QrPass = {
  fullName: string;
  email: string;
  passCode: string;
  qrDataUrl: string;
};

type Credentials = {
  fullName: string;
  email: string;
  password: string;
};

export default function RegistrationForm() {
  const registrationFormRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<Credentials | null>(null);
  const [showVerificationOnly, setShowVerificationOnly] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<Credentials | null>(null);
  const [qrPass, setQrPass] = useState<QrPass | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginCountryCode, setLoginCountryCode] = useState("+63");
  const [loginMobileNum, setLoginMobileNum] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [countryCode, setCountryCode] = useState("+63");
  const [mobileNum, setMobileNum] = useState("");

  // ── Modals State ──
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [socialMissions, setSocialMissions] = useState<any[]>([]);
  const [missionTimers, setMissionTimers] = useState<Record<number, number | null>>({});

  useEffect(() => {
    setMounted(true);
    fetch("/api/social-missions")
      .then(res => res.json())
      .then(data => {
        if (data.missions) setSocialMissions(data.missions);
      })
      .catch(console.error);
  }, []);

  // Generic timer countdown
  useEffect(() => {
    const hasActive = Object.values(missionTimers).some(val => val !== null && val > 0);
    if (!hasActive) return;

    const interval = setInterval(() => {
      setMissionTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const key in next) {
          if (next[key] !== null && next[key]! > 0) {
            next[key] = next[key]! - 1;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [missionTimers]);

  const handleFollowMission = (missionId: number, url: string) => {
    window.open(url, "_blank");
    setMissionTimers(prev => ({ ...prev, [missionId]: 10 }));
  };

  const allMissionsCompleted = socialMissions.length > 0 && socialMissions.every(m => missionTimers[m.id] === 0);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, ""); // digits only
    if (value.startsWith("0")) {
      value = value.substring(1); // strip leading zero
    }
    setMobileNum(value);
  };

  const handleLoginMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, ""); // digits only
    if (value.startsWith("0")) {
      value = value.substring(1); // strip leading zero
    }
    setLoginMobileNum(value);
  };

  const loginHint = useMemo(
    () => pendingLogin?.email ?? authenticatedUser?.email ?? "",
    [authenticatedUser?.email, pendingLogin?.email],
  );

  const generateQrPass = async (credentials: Credentials) => {
    setQrLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const qrResponse = await fetch("/api/qr-pass", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const qrResult = (await qrResponse.json()) as
        | { message?: string; error?: string; qrDataUrl?: string; passCode?: string; fullName?: string; email?: string }
        | undefined;

      if (!qrResponse.ok || !qrResult?.qrDataUrl || !qrResult.passCode) {
        setStatus({
          type: "error",
          message: qrResult?.error ?? "QR pass generation failed.",
        });
        return;
      }

      setQrPass({
        fullName: qrResult.fullName ?? credentials.fullName,
        email: qrResult.email ?? credentials.email,
        passCode: qrResult.passCode,
        qrDataUrl: qrResult.qrDataUrl,
      });
      setStatus({
        type: "success",
        message: qrResult.message ?? "Your QR pass is ready.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get("fullName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const organization = String(data.get("organization") ?? "").trim();
    const phone = countryCode + mobileNum;
    const password = "blockquest2026";
    const terms = data.get("terms") === "on";
    const dataGathering = data.get("data_gathering") === "on";

    if (!fullName || !email || !mobileNum || !terms || !dataGathering) {
      setStatus({
        type: "error",
        message: "Please complete all required fields correctly.",
      });
      return;
    }

    setSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const registrationResponse = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          organization,
          password,
          terms,
          dataGathering,
        }),
      });

      const registrationResult = (await registrationResponse.json()) as
        | { message?: string; error?: string }
        | undefined;

      if (!registrationResponse.ok) {
        setStatus({
          type: "error",
          message: registrationResult?.error ?? "Unable to save your registration.",
        });
        return;
      }

      const credentials = { fullName, email, password };

      setPendingLogin(credentials);
      setAuthenticatedUser(null);
      setLoginEmail(email);
      setLoginCountryCode(countryCode);
      setLoginMobileNum(mobileNum);
      setLoginPassword(password);
      setQrPass(null);
      setStatus({
        type: "success",
        message:
          registrationResult?.message ??
          `Thanks, ${fullName}! Registration saved. Click below to verify and unlock your QR pass.`,
      });
      form.reset();
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = loginEmail.trim();
    const phone = loginCountryCode + loginMobileNum;
    const password = "blockquest2026";

    if (!email || !loginMobileNum) {
      setStatus({
        type: "error",
        message: "Enter your email and phone to verify.",
      });
      return;
    }

    setLoginSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          phone,
          password,
        }),
      });

      const loginResult = (await loginResponse.json()) as
        | { message?: string; error?: string; fullName?: string; email?: string }
        | undefined;

      if (!loginResponse.ok || !loginResult?.fullName || !loginResult.email) {
        setStatus({
          type: "error",
          message: loginResult?.error ?? "Login failed.",
        });
        return;
      }

      const credentials = {
        fullName: loginResult.fullName,
        email: loginResult.email,
        password,
      };

      setAuthenticatedUser(credentials);
      setPendingLogin(credentials);
      setStatus({
        type: "success",
        message: loginResult.message ?? "Login successful. You can now generate your QR pass.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setLoginSubmitting(false);
    }
  };

  return (
    <div className="registration-stack">
      {!pendingLogin && !showVerificationOnly && !authenticatedUser && !qrPass ? (
        <form ref={registrationFormRef} className="form" noValidate onSubmit={handleRegistration}>
        <label>
            Name
            <input name="fullName" type="text" autoComplete="name" placeholder="Mara Ellison" required />
          </label>

        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="mara@studio.com" required />
        </label>

        <label>
          Phone number
          <div className="phone-input-group">
            <select
              className="country-code-select"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{
                width: "125px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "14px 24px 14px 12px",
                background: "rgba(255, 255, 255, 0.04)",
                color: "#fff",
                font: "inherit",
                fontSize: "0.9rem"
              }}
            >
              <option value="+63">+63 (PH)</option>
              <option value="+1">+1 (US)</option>
              <option value="+65">+65 (SG)</option>
              <option value="+60">+60 (MY)</option>
              <option value="+84">+84 (VN)</option>
              <option value="+62">+62 (ID)</option>
              <option value="+81">+81 (JP)</option>
            </select>
            <input
              className="mobile-number-input"
              type="tel"
              placeholder="9062818246"
              value={mobileNum}
              onChange={handleMobileChange}
              required
            />
          </div>
        </label>

        <label>
          Organization (optional)
          <input
            name="organization"
            type="text"
            autoComplete="organization"
            placeholder="BlockQuest Labs"
          />
        </label>



        <label className="form__checkbox form__checkbox--privacy" suppressHydrationWarning>
          <input name="data_gathering" type="checkbox" required className="form__checkbox-input" />
          <span className="form__checkbox-text" suppressHydrationWarning>
            I consent to the use of my data for event analytics, and agree to receive marketing updates and communications.
          </span>
        </label>

        <label className="form__checkbox form__checkbox--privacy" suppressHydrationWarning style={{ marginTop: "12px", marginBottom: "16px" }}>
          <input name="terms" type="checkbox" required className="form__checkbox-input" />
          <span className="form__checkbox-text" suppressHydrationWarning>
            I have read and agree to the <strong>Terms & Conditions</strong> and the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowPrivacyModal(true);
              }}
              className="privacy-modal-btn"
            >
              Data Privacy Policy (RA 10173)
            </button>.
          </span>
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Register"}
        </button>

        <div style={{ textAlign: "center", marginTop: "4px" }}>
          <button
            type="button"
            onClick={() => {
              setShowVerificationOnly(true);
              setStatus({ type: "idle", message: "" });
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--gold-light)",
              textDecoration: "underline",
              cursor: "pointer",
              width: "auto",
              boxShadow: "none",
              padding: "4px 8px"
            }}
          >
            Already registered? Unlock QR Pass
          </button>
        </div>

        <p id="form-message" className={`form__message ${status.type}`} role="status" aria-live="polite">
          {status.message}
        </p>
        </form>
      ) : null}

      {(pendingLogin || showVerificationOnly) && !authenticatedUser ? (
        <section className="app-card login-card" aria-labelledby="login-title">
          <div className="section-head">
            <div>
              <p className="section-head__eyebrow">Login required</p>
              <h2 id="login-title">Unlock your QR pass</h2>
            </div>
            <span className="section-head__meta">Secure</span>
          </div>

          <p className="login-card__hint">
            Confirm your email address and phone number below to unlock your QR ticket pass.
          </p>

          <form className="form form--compact" noValidate onSubmit={handleLogin}>
            <label>
              Email
              <input
                name="loginEmail"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Phone number
              <div className="phone-input-group" style={{ display: "flex", gap: "8px" }}>
                <select
                  className="country-code-select"
                  value={loginCountryCode}
                  onChange={(e) => setLoginCountryCode(e.target.value)}
                  style={{
                    width: "125px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "14px 24px 14px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    color: "#fff",
                    font: "inherit",
                    fontSize: "0.9rem"
                  }}
                >
                  <option value="+63">+63 (PH)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+65">+65 (SG)</option>
                  <option value="+60">+60 (MY)</option>
                  <option value="+84">+84 (VN)</option>
                  <option value="+62">+62 (ID)</option>
                  <option value="+81">+81 (JP)</option>
                </select>
                <input
                  className="mobile-number-input"
                  type="tel"
                  placeholder="9062818246"
                  value={loginMobileNum}
                  onChange={handleLoginMobileChange}
                  required
                />
              </div>
            </label>

            <button type="submit" disabled={loginSubmitting}>
              {loginSubmitting ? "Verifying..." : "Verify and unlock QR pass"}
            </button>

            {status.message && (
              <p className={`form__message ${status.type}`} role="status" aria-live="polite" style={{ marginTop: "16px" }}>
                {status.message}
              </p>
            )}

            {!pendingLogin && (
              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowVerificationOnly(false);
                    setStatus({ type: "idle", message: "" });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    width: "auto",
                    boxShadow: "none",
                    padding: "4px 8px"
                  }}
                >
                  ← Back to registration
                </button>
              </div>
            )}
          </form>
        </section>
      ) : null}

      {authenticatedUser ? (
        <div className="qr-pass__actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              if (allMissionsCompleted || socialMissions.length === 0) {
                void generateQrPass(authenticatedUser);
              } else {
                setShowSocialModal(true);
              }
            }}
            disabled={qrLoading}
          >
            {qrLoading ? "Generating QR Pass..." : "Generate QR Pass"}
          </button>
          <p className="qr-pass__hint">Logged in as {authenticatedUser.email}.</p>
        </div>
      ) : null}

      {/* ── Social Media Follow Modal (10s Countdown Fake Auto-Verification) ── */}
      {showSocialModal && mounted && createPortal(
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
              background: "linear-gradient(135deg, rgba(20, 24, 38, 0.98), rgba(12, 14, 22, 0.98))",
              border: "1px solid rgba(245, 166, 35, 0.4)",
              borderRadius: "24px",
              padding: "28px 24px",
              boxShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
              textAlign: "center",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowSocialModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: "2.4rem", marginBottom: "8px" }}>📣</div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
              Social Follow Missions
            </h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>
              Complete all {socialMissions.length} social follow missions to auto-verify & unlock your <strong>BlockQuest Event QR Pass</strong>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {socialMissions.map((mission) => {
                const timer = missionTimers[mission.id];
                return (
                  <div
                    key={mission.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "14px",
                      background: "rgba(255,255,255,0.04)",
                      border: timer === 0 ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                      <span style={{ fontSize: "1.3rem" }}>
                        {mission.platform === 'facebook' ? '🌐' : mission.platform === 'telegram' ? '✈️' : mission.platform === 'twitter' ? '🐦' : '🔗'}
                      </span>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>{mission.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>{mission.description}</div>
                      </div>
                    </div>
                    {timer === 0 ? (
                      <span style={{ color: "#34d399", fontWeight: 800, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 4 }}>
                        ✓ Verified
                      </span>
                    ) : timer !== null && timer !== undefined ? (
                      <span style={{ color: "#fbbf24", fontSize: "0.82rem", fontWeight: 700, background: "rgba(245, 191, 36, 0.15)", padding: "4px 10px", borderRadius: "8px", border: "1px solid rgba(245, 191, 36, 0.3)" }}>
                        ⏳ Verifying {timer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFollowMission(mission.id, mission.url)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "10px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          background: mission.button_color || "#1877f2",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {mission.button_text}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!allMissionsCompleted || qrLoading}
              onClick={async () => {
                if (allMissionsCompleted) {
                  setShowSocialModal(false);
                  if (authenticatedUser) {
                    await generateQrPass(authenticatedUser);
                  }
                }
              }}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                fontSize: "0.95rem",
                fontWeight: 800,
                background:
                  allMissionsCompleted
                    ? "linear-gradient(135deg, #f5a623 0%, #e0850b 100%)"
                    : "rgba(255, 255, 255, 0.1)",
                color: allMissionsCompleted ? "#120b02" : "rgba(255, 255, 255, 0.4)",
                border: "none",
                cursor: allMissionsCompleted ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
              }}
            >
              {!allMissionsCompleted
                ? `🔒 Follow All ${socialMissions.length} Socials to Unlock`
                : "⚡ Claim & Generate QR Pass →"}
            </button>
          </div>
        </div>,
        document.body
      )}

      {qrPass ? (
        <section className="qr-pass" aria-labelledby="qr-pass-title">
          <div className="qr-pass__header">
            <div>
              <p className="qr-pass__eyebrow">Your QR Pass</p>
              <h3 id="qr-pass-title">Ready to use</h3>
            </div>
            <span className="qr-pass__code">{qrPass.passCode}</span>
          </div>

          <div className="qr-pass__body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            <div className="qr-pass__wrapper" style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
              <img
                className="qr-pass__image"
                src={qrPass.qrDataUrl}
                alt={`QR pass for ${qrPass.fullName}`}
                style={{ width: "260px", height: "260px", display: "block" }}
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
                width: "64px",
                height: "64px"
              }}>
                <img src="/logo.png" alt="BlockQuest Logo" style={{ width: "64px", height: "64px", objectFit: "contain" }} />
              </div>
            </div>
            <div className="qr-pass__meta" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p>
                <strong>{qrPass.fullName}</strong>
              </p>
              <p>{qrPass.email}</p>
              <p>Show this at the entrance.</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Data Privacy Policy Modal (RA 10173 Compliant) ── */}
      {showPrivacyModal && mounted && createPortal(
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "linear-gradient(135deg, rgba(20, 24, 38, 0.98), rgba(12, 14, 22, 0.98))",
              border: "1px solid rgba(245, 166, 35, 0.4)",
              borderRadius: "24px",
              padding: "28px 24px",
              boxShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
              textAlign: "left",
              position: "relative",
              color: "#fff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPrivacyModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "20px", color: "var(--gold-light)" }}>
              Data Privacy Policy
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.88rem", lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
              <p>
                In compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, BlockQuest Fiesta PH is committed to protecting your personal information.
              </p>

              <div>
                <strong style={{ color: "#fff" }}>1. Information Collected:</strong>
                <p style={{ marginTop: 4 }}>
                  We collect your Full Name, Email Address, Mobile Phone Number, and Organization name for the purpose of event registration, ticket verification, and quest leaderboard tracking.
                </p>
              </div>

              <div>
                <strong style={{ color: "#fff" }}>2. Purpose of Collection:</strong>
                <p style={{ marginTop: 4 }}>
                  Your data is used to generate your secure entrance QR Pass, verify your social media follows (for gated pass unlock), track your points/XP in quests, and send official event updates.
                </p>
              </div>

              <div>
                <strong style={{ color: "#fff" }}>3. Data Protection & Sharing:</strong>
                <p style={{ marginTop: 4 }}>
                  We do not sell, rent, or trade your personal information to third parties. All data is securely stored and processed solely for event administration.
                </p>
              </div>

              <div>
                <strong style={{ color: "#fff" }}>4. Your Data Rights:</strong>
                <p style={{ marginTop: 4 }}>
                  You have the right to request access to, update, or delete your registration data by contacting our Data Protection Officer at <em>marketing@block-quest.com</em>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "12px",
                borderRadius: "14px",
                fontSize: "0.9rem",
                fontWeight: 800,
                background: "linear-gradient(135deg, #f5a623 0%, #e0850b 100%)",
                color: "#120b02",
                border: "none",
                cursor: "pointer",
              }}
            >
              I Understand & Accept
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
