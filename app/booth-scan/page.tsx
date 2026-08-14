"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";

interface Attendee {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  organization: string | null;
  ticket_code: string | null;
  total_xp: number;
}

type ScanStatus = "idle" | "loading" | "already_visited" | "invalid" | "success";

interface BoothStaffUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

export default function BoothScanPage() {
  // ── Client Mount & Auth Gate ──
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState<BoothStaffUser | null>(null);

  // ── Booth Configuration ──
  const [boothPoints, setBoothPoints] = useState<number>(150);

  // ── Scanner ──
  const scannerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  // ── Scan Results ──
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [awardedXp, setAwardedXp] = useState<number>(0);
  const [awardedAt, setAwardedAt] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [scanCount, setScanCount] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Restore authenticated booth session from sessionStorage (auto-cleared on browser/tab close)
  useEffect(() => {
    setMounted(true);
    const saved = sessionStorage.getItem("blockquest_booth_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const role = parsed.user?.role;
        const ALLOWED_ROLES = ["superadmin", "admin", "booth_staff"];
        if (parsed.authed && parsed.user && ALLOWED_ROLES.includes(role)) {
          setCurrentUser(parsed.user);
          setAuthed(true);
        } else {
          sessionStorage.removeItem("blockquest_booth_session");
        }
      } catch {}
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    return audioContextRef.current;
  }, []);

  const unlockAudio = useCallback(async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
  }, [getAudioContext]);

  // Audio effects
  const playSuccessTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 150]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, t);
    osc.frequency.setValueAtTime(880, t + 0.1);
    osc.frequency.setValueAtTime(1174.66, t + 0.22);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.8, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  }, [getAudioContext]);

  const playAlreadyVisitedTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(370, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }, [getAudioContext]);

  const playFailureTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.setValueAtTime(164.81, t + 0.15);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }, [getAudioContext]);

  // ── Login Handler ──
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError("");
    await unlockAudio();

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed.");

      const role = json.adminUser?.role;
      const ALLOWED_ROLES = ["superadmin", "admin", "booth_staff"];
      if (!ALLOWED_ROLES.includes(role)) {
        throw new Error(`Access Denied. Role "${role}" is not authorized to operate booth stations. Only Superadmin, Manager, and Booth Staff are permitted.`);
      }

      setCurrentUser(json.adminUser);
      setAuthed(true);
      sessionStorage.setItem("blockquest_booth_session", JSON.stringify({
        authed: true,
        user: json.adminUser
      }));
    } catch (err: any) {
      setAuthError(err.message || "Invalid booth email or password.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    setAuthed(false);
    setCurrentUser(null);
    setLoginPassword("");
    sessionStorage.removeItem("blockquest_booth_session");
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }

  // ── Process Scan ──
  const processScan = useCallback(
    async (code: string) => {
      const cleaned = code.trim().toUpperCase();
      if (!cleaned || !currentUser) return;

      setStatus("loading");
      setAttendee(null);
      setErrorMsg("");
      setShowSheet(true);

      const boothSlug = currentUser.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "booth-station";
      const boothName = currentUser.fullName;

      try {
        const res = await fetch("/api/booth-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticket_code: cleaned,
            booth_id: boothSlug,
            booth_name: boothName,
            points: boothPoints,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.valid) {
          setStatus("invalid");
          setErrorMsg(json.error || "Attendee ticket not found.");
          playFailureTone();
          return;
        }

        const a: Attendee = json.attendee;
        setAttendee(a);

        if (json.already_visited) {
          setStatus("already_visited");
          setAwardedXp(json.xp_awarded || boothPoints);
          setAwardedAt(json.awarded_at);
          playAlreadyVisitedTone();
        } else {
          setStatus("success");
          setAwardedXp(json.xp_awarded || boothPoints);
          setScanCount(prev => prev + 1);
          playSuccessTone();
        }
      } catch (err: any) {
        setStatus("invalid");
        setErrorMsg("Network error. Please try again.");
        playFailureTone();
      }
    },
    [currentUser, boothPoints, playFailureTone, playSuccessTone, playAlreadyVisitedTone]
  );

  // ── Scanner lifecycle (Matching /scan implementation) ──
  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;

    await unlockAudio();
    setCameraError("");

    try {
      const scanner = new Html5Qrcode("booth-qr-reader", {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText: string) => {
          scanner.pause();
          setScanning(false);
          processScan(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      scannerRef.current = null;
      setCameraError(err?.message ?? "Camera unavailable.");
    }
  }, [processScan, unlockAudio]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (authed) {
      const timer = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    }
  }, [authed, startScanner, stopScanner]);

  const resetAndScan = useCallback(async () => {
    setStatus("idle");
    setAttendee(null);
    setErrorMsg("");
    setManualCode("");
    setShowSheet(false);

    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
        setScanning(true);
      } catch {
        await startScanner();
      }
    } else {
      await startScanner();
    }
  }, [startScanner]);

  // ── Render Login Gate ──
  if (!authed) {
    return (
      <main className="scan-login" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(168, 85, 247, 0.12) 0%, #07090e 80%)" }} suppressHydrationWarning>
        <div className="scan-login__card" style={{ borderColor: "rgba(168, 85, 247, 0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(168, 85, 247, 0.15)" }} suppressHydrationWarning>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.8rem",
            margin: "0 auto 16px"
          }}>
            🏪
          </div>
          <h1>Booth Staff Login</h1>
          <p className="scan-login__hint" style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
            Enter your dedicated vendor/booth email and password to start scanning attendees.
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }} suppressHydrationWarning>
            <input
              className="scan-login__input"
              type="email"
              required
              placeholder="Booth email (e.g. booth.polygon@blockquest.ph)"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              suppressHydrationWarning
            />
            <input
              className="scan-login__input"
              type="password"
              required
              placeholder="Booth password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              suppressHydrationWarning
            />
            {authError && <p className="scan-error-inline" style={{ color: "#f87171" }}>{authError}</p>}
            
            <button
              type="submit"
              className="scan-login__btn"
              disabled={loginLoading}
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                color: "#fff",
                fontWeight: 800,
                marginTop: 4,
                padding: "14px"
              }}
            >
              {loginLoading ? "Authenticating…" : "Unlock Booth Scanner →"}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link href="/" className="scan-back-link" style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
              ← Return to Home Portal
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Render Scanner View ──
  return (
    <div className="scan-wrapper" style={{ background: "radial-gradient(circle at 50% 20%, rgba(139, 92, 246, 0.12) 0%, #06070c 80%)" }}>
      <main className="scan-page" style={{ maxWidth: 500, borderColor: "rgba(168, 85, 247, 0.4)", boxShadow: "0 0 50px rgba(168, 85, 247, 0.2)" }}>
        {/* Success flash */}
        {status === "success" && <div className="scan-flash-overlay" style={{ background: "rgba(168, 85, 247, 0.3)" }} />}

        {/* Top bar */}
        <header className="scan-topbar" style={{
          background: "rgba(13, 14, 25, 0.96)",
          borderBottom: "1px solid rgba(168, 85, 247, 0.25)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px"
        }}>
          <div className="scan-topbar__brand" style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              flexShrink: 0
            }}>
              🏪
            </div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <span style={{
                fontSize: "0.92rem",
                fontWeight: 800,
                color: "#fff",
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {currentUser?.fullName || "Vendor Booth"}
              </span>
              <span style={{
                fontSize: "0.72rem",
                color: "#c084fc",
                letterSpacing: "0.02em",
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {currentUser?.email}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            Logout
          </button>
        </header>

        {/* Active Station Points Banner */}
        <div style={{
          background: "linear-gradient(90deg, rgba(20, 16, 35, 0.98) 0%, rgba(13, 14, 25, 0.98) 100%)",
          borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
          padding: "10px 16px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: "12px"
        }}>
          <div>
            <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", display: "block" }}>
              Session Scans
            </span>
            <strong style={{ fontSize: "0.95rem", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
              👥 {scanCount} Attendees
            </strong>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
              Reward
            </span>
            <span
              style={{
                background: "rgba(245, 166, 35, 0.15)",
                border: "1px solid rgba(245, 166, 35, 0.4)",
                color: "var(--gold-light)",
                padding: "3px 10px",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: "0.82rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              ⚡ +{boothPoints} XP
            </span>
          </div>
        </div>

        {/* Camera Scanner Viewport */}
        <div className="scan-camera-area" style={{ background: "#05050a", position: "relative" }}>
          <div id="booth-qr-reader" className="scan-camera-inner" style={{ minHeight: "100%", width: "100%" }} />

          {status === "idle" && scanning && (
            <div className="scan-instruction" style={{
              background: "rgba(10, 10, 20, 0.85)",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
              bottom: "16px"
            }}>
              <span>📷 Point camera at Attendee QR Pass (+{boothPoints} XP)</span>
            </div>
          )}

          {cameraError && (
            <div className="scan-camera-error-overlay">
              <span style={{ fontSize: "2rem" }}>📵</span>
              <p>{cameraError}</p>
              <button className="scan-retry-btn" onClick={startScanner}>Retry Camera</button>
            </div>
          )}
        </div>

        {/* Manual Input Code Bar */}
        {!showSheet && (
          <div className="scan-manual-bar" style={{ background: "rgba(10, 11, 20, 0.95)" }}>
            <input
              className="scan-manual-input"
              type="text"
              placeholder="Manual ticket code (BQF-XXXXXX)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") processScan(manualCode); }}
              style={{ borderColor: "rgba(168, 85, 247, 0.25)" }}
            />
            <button
              className="scan-manual-btn"
              onClick={() => processScan(manualCode)}
              disabled={!manualCode.trim() || status === "loading"}
              style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#fff" }}
            >
              ⚡
            </button>
          </div>
        )}

        {/* ── Result Bottom Sheet ── */}
        {showSheet && (
          <div className={`scan-sheet scan-sheet--${status}`}>
            {status === "loading" && (
              <div className="scan-sheet-loading">
                <div className="scan-sheet-spinner" style={{ borderTopColor: "#a855f7" }} />
                <p>Verifying visit & awarding points…</p>
              </div>
            )}

            {/* Invalid Ticket */}
            {status === "invalid" && (
              <div className="scan-sheet-body">
                <div className="scan-sheet-banner scan-sheet-banner--invalid">
                  <span className="scan-sheet-icon">❌</span>
                  <div>
                    <p className="scan-sheet-title">Invalid Pass</p>
                    <p className="scan-sheet-sub">{errorMsg}</p>
                  </div>
                </div>
                <button className="scan-sheet-action scan-sheet-action--reset" onClick={resetAndScan}>
                  🔄 Scan Next Attendee
                </button>
              </div>
            )}

            {/* Already Visited This Booth */}
            {status === "already_visited" && attendee && (
              <div className="scan-sheet-body" style={{ borderColor: "rgba(245, 166, 35, 0.5)", background: "rgba(18, 16, 26, 0.98)" }}>
                <div className="scan-sheet-banner scan-sheet-banner--warning" style={{ background: "rgba(245, 166, 35, 0.15)" }}>
                  <span className="scan-sheet-icon">⚠️</span>
                  <div>
                    <p className="scan-sheet-title" style={{ color: "#fbbf24" }}>Already Visited Booth</p>
                    <p className="scan-sheet-sub">
                      Attendee already received points (+{awardedXp} XP) for this booth.
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "center", margin: "4px 0" }}>
                  <div className="scan-sheet-name">{attendee.full_name}</div>
                  <div className="scan-sheet-ticket">{attendee.ticket_code}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--gold-light)", marginTop: 4 }}>
                    Total Wallet: ⚡ {attendee.total_xp} XP
                  </div>
                </div>
                <div className="scan-sheet-action-row">
                  <button className="scan-sheet-action scan-sheet-action--reset" onClick={resetAndScan}>
                    🔄 Scan Next Attendee
                  </button>
                </div>
              </div>
            )}

            {/* Success: First Visit Points Awarded! */}
            {status === "success" && attendee && (
              <div className="scan-sheet-body scan-sheet-body--success" style={{
                borderColor: "rgba(168, 85, 247, 0.6)",
                boxShadow: "0 0 40px rgba(168, 85, 247, 0.3)",
                background: "linear-gradient(180deg, rgba(25, 20, 45, 0.98) 0%, rgba(12, 12, 24, 0.98) 100%)"
              }}>
                <div className="scan-sheet-success-icon" style={{ filter: "drop-shadow(0 0 16px rgba(168, 85, 247, 0.8))" }}>
                  🎉
                </div>
                <p className="scan-sheet-success-title" style={{ color: "#c084fc", textShadow: "0 0 20px rgba(192, 132, 252, 0.6)" }}>
                  +{awardedXp} XP AWARDED!
                </p>
                <div style={{ fontSize: "0.85rem", color: "#e9d5ff", marginBottom: 2 }}>
                  First Visit to <strong>{currentUser?.fullName}</strong>
                </div>
                <div className="scan-sheet-name" style={{ fontSize: "1.2rem", fontWeight: 900 }}>
                  {attendee.full_name}
                </div>
                <div className="scan-sheet-ticket">{attendee.ticket_code}</div>
                <div style={{
                  background: "rgba(245, 166, 35, 0.15)",
                  border: "1px solid rgba(245, 166, 35, 0.3)",
                  borderRadius: 12,
                  padding: "6px 14px",
                  color: "var(--gold-light)",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  marginTop: 4
                }}>
                  New Balance: ⚡ {attendee.total_xp} XP
                </div>
                <div className="scan-sheet-action-row" style={{ width: "100%", marginTop: 8 }}>
                  <button
                    className="scan-sheet-action"
                    onClick={resetAndScan}
                    style={{
                      background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                      color: "#fff",
                      fontWeight: 800
                    }}
                  >
                    ➡ Scan Next Attendee
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
