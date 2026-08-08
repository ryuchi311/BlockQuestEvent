"use client";

import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";

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
    const firstName = String(data.get("firstName") ?? "").trim();
    const lastName = String(data.get("lastName") ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const email = String(data.get("email") ?? "").trim();
    const organization = String(data.get("organization") ?? "").trim();
    const phone = countryCode + mobileNum;
    const password = "blockquest2026";
    const terms = data.get("terms") === "on";

    if (!firstName || !lastName || !email || !mobileNum || !terms) {
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
            First name
            <input name="firstName" type="text" autoComplete="given-name" placeholder="Mara" required />
          </label>

          <label>
            Last name
            <input name="lastName" type="text" autoComplete="family-name" placeholder="Ellison" required />
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



        <label className="form__checkbox">
          <input name="terms" type="checkbox" required />
          <span>I agree to the use of my personal information.</span>
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
            onClick={() => void generateQrPass(authenticatedUser)}
            disabled={qrLoading}
          >
            {qrLoading ? "Generating QR Pass..." : "Generate QR Pass"}
          </button>
          <p className="qr-pass__hint">Logged in as {authenticatedUser.email}.</p>
        </div>
      ) : null}

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
    </div>
  );
}
