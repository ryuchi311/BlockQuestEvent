"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface Attendee {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  organization: string | null;
  ticket_code: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

type PassStatus = "idle" | "loading" | "already_in" | "invalid" | "success";

export default function ScanPage() {
  // ── Auth ──────────────────────────────────────────────────────
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // ── Scanner ───────────────────────────────────────────────────
  const scannerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  // ── Result ────────────────────────────────────────────────────
  const [status, setStatus] = useState<PassStatus>("idle");
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      try {
        await ctx.resume();
      } catch {}
    }
  }, [getAudioContext]);

  const playSuccessTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 60, 30, 250]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 0.01);
    master.connect(compressor);

    // C5 → E5 → G5 → C6 victory jingle, each note doubled with a harmony
    const notes: Array<{ freq: number; harmony: number; start: number; dur: number }> = [
      { freq: 523.25, harmony: 659.25,  start: 0,    dur: 0.20 },
      { freq: 659.25, harmony: 783.99,  start: 0.16, dur: 0.20 },
      { freq: 783.99, harmony: 987.77,  start: 0.32, dur: 0.22 },
      { freq: 1046.5, harmony: 1318.51, start: 0.50, dur: 0.55 },
    ];

    notes.forEach(({ freq, harmony, start, dur }) => {
      [freq, harmony].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.value = f;
        const t = ctx.currentTime + start;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.9 : 0.5, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    });

  }, [getAudioContext]);

  const playFailureTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([120, 60, 180]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 6;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);
    master.connect(compressor);

    const notes = [
      { freq: 220, start: 0, dur: 0.12 },
      { freq: 196, start: 0.11, dur: 0.12 },
      { freq: 164.81, start: 0.22, dur: 0.18 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.85, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }, [getAudioContext]);

  const playAlreadyInTone = useCallback(() => {
    if (typeof window === "undefined") return;
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 180]);

    const ctx = getAudioContext();
    if (!ctx) return;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 5;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.95, ctx.currentTime + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.46);
    master.connect(compressor);

    const notes = [554.37, 440, 554.37, 392];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const t = ctx.currentTime + index * 0.11;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.95, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }, [getAudioContext]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  // ── Auth gate ─────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Restore authenticated gate session from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("blockquest_gate_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const role = parsed.user?.role;
        const BLOCKED_ROLES = ["booth_staff", "verifier"];
        if (parsed.authed && parsed.user && !BLOCKED_ROLES.includes(role)) {
          setCurrentUser(parsed.user);
          setAuthed(true);
        } else {
          sessionStorage.removeItem("blockquest_gate_session");
        }
      } catch {}
    }
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError("");
    await unlockAudio();

    // Support legacy fallback or full DB authentication
    if (password === "blockquest2026" && !loginEmail) {
      setAuthed(true);
      setLoginLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || "Login failed.");

      const role = json.adminUser?.role;
      if (role === "booth_staff") {
        throw new Error("Access Denied. Booth Staff accounts are restricted to /booth-scan and cannot access the Gate Entrance Scanner.");
      }
      if (role === "verifier") {
        throw new Error("Access Denied. Verifier accounts cannot access the Gate Scanner.");
      }

      setCurrentUser(json.adminUser);
      setAuthed(true);
      sessionStorage.setItem("blockquest_gate_session", JSON.stringify({
        authed: true,
        user: json.adminUser,
        token: json.token,
      }));
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials.");
    } finally {
      setLoginLoading(false);
    }
  }

  function getGateToken(): string {
    if (typeof window === "undefined") return "";
    try {
      const saved = sessionStorage.getItem("blockquest_gate_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.token || "";
      }
    } catch {}
    return "";
  }

  // ── Lookup + auto check-in ────────────────────────────────────
  const lookupCode = useCallback(async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;

    setStatus("loading");
    setAttendee(null);
    setErrorMsg("");
    setShowSheet(true);

    try {
      const token = getGateToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/checkin?code=${encodeURIComponent(cleaned)}`, {
        headers,
      });
      const json = await safeJson(res);

      if (!res.ok || !json.valid) {
        setStatus("invalid");
        setErrorMsg(json.error || "Ticket not found.");
        playFailureTone();
        if (retryCount < 2) {
          setRetryCount((prev) => prev + 1);
          window.setTimeout(() => {
            setStatus("idle");
            setAttendee(null);
            setErrorMsg("");
            setShowSheet(false);
            if (scannerRef.current) {
              scannerRef.current.resume().catch(() => {});
            }
          }, 900);
        }
        return;
      }

      const a: Attendee = json.attendee;
      setRetryCount(0);

      if (a.checked_in) {
        setAttendee(a);
        setStatus("already_in");
        playAlreadyInTone();
        return;
      }

      // Auto confirm check-in immediately
      try {
        const res2 = await fetch("/api/admin/checkin", {
          method: "POST",
          headers,
          body: JSON.stringify({ ticket_code: a.ticket_code }),
        });
        const json2 = await safeJson(res2);
        if (json2.valid) {
          setAttendee({ ...a, checked_in: true, checked_in_at: new Date().toISOString() });
          setStatus("success");
          playSuccessTone();
        } else {
          setAttendee(a);
          setStatus("invalid");
          setErrorMsg("Check-in failed. Try again.");
          playFailureTone();
        }
      } catch {
        setAttendee(a);
        setStatus("invalid");
        setErrorMsg("Check-in failed. Try again.");
        playFailureTone();
      }
    } catch {
      setStatus("invalid");
      setErrorMsg("Network error. Try again.");
      playFailureTone();
      if (retryCount < 2) {
        setRetryCount((prev) => prev + 1);
        window.setTimeout(() => {
          setStatus("idle");
          setAttendee(null);
          setErrorMsg("");
          setShowSheet(false);
          if (scannerRef.current) {
            scannerRef.current.resume().catch(() => {});
          }
        }, 900);
      }
    }
  }, [retryCount, playAlreadyInTone, playFailureTone, playSuccessTone]);

  // ── Start scanner ─────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;

    await unlockAudio();
    setCameraError("");
    try {
      const scanner = new Html5Qrcode("qr-fullscreen-reader", {
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
          lookupCode(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      scannerRef.current = null;
      setCameraError(err?.message ?? "Camera unavailable.");
    }
  }, [lookupCode, unlockAudio]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Auto-start camera on auth
  useEffect(() => {
    if (authed) {
      setTimeout(startScanner, 300);
    }
    return () => { stopScanner(); };
  }, [authed, startScanner, stopScanner]);

  // Reset and resume scanner
  const resetAndScan = useCallback(async () => {
    setStatus("idle");
    setAttendee(null);
    setErrorMsg("");
    setManualCode("");
    setShowSheet(false);
    setRetryCount(0);
    if (scannerRef.current) {
      try { await scannerRef.current.resume(); setScanning(true); } catch {
        await startScanner();
      }
    } else {
      await startScanner();
    }
  }, [startScanner]);

  // ── Render Guard for SSR Hydration ──
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // ── Login gate ────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="scan-login" suppressHydrationWarning>
        <div className="scan-login__card" suppressHydrationWarning>
          <img
            src="https://block-quest.com/assets/images/block_quest_logo.png"
            alt="BlockQuest Logo"
            className="scan-login__logo"
          />
          <h1>Gate Scanner Login</h1>
          <p className="scan-login__hint">Enter gate staff credentials to start check-in scanning.</p>
          <form onSubmit={handleLogin} suppressHydrationWarning style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="scan-login__input"
              type="email"
              placeholder="Staff email (e.g. gate@blockquest.ph)"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              suppressHydrationWarning
            />
            <input
              className="scan-login__input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suppressHydrationWarning
            />
            {authError && <p className="scan-error-inline" style={{ color: "#f87171" }}>{authError}</p>}
            <button type="submit" className="scan-login__btn" disabled={loginLoading}>
              {loginLoading ? "Authenticating..." : "Unlock Scanner →"}
            </button>
          </form>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <Link href="/shortcut" className="scan-back-link" style={{ color: "var(--gold-light)" }}>← Back to Shortcut</Link>
            <Link href="/admin" className="scan-back-link">Admin Dashboard →</Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Scanner view ──────────────────────────────────────────────
  return (
    <div className="scan-wrapper">
      <main className="scan-page">
        {/* Full-screen success flash */}
        {status === "success" && <div className="scan-flash-overlay" />}

      {/* Top bar */}
      <header className="scan-topbar">
        <div className="scan-topbar__brand">
          <img
            src="https://block-quest.com/assets/images/block_quest_logo.png"
            alt="BlockQuest"
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <span>QR Scanner</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/shortcuts" className="scan-topbar__back" style={{ borderColor: "rgba(245, 166, 35, 0.4)", color: "var(--gold-light)" }}>🧭 Hub</Link>
          <Link href="/admin" className="scan-topbar__back">✕ Exit</Link>
        </div>
      </header>

      {/* Camera fullscreen area */}
      <div className="scan-camera-area">
        <div id="qr-fullscreen-reader" className="scan-camera-inner" />

        {/* Finder overlay when scanning */}
        {scanning && (
          <div className="scan-finder-overlay">
            <div className="scan-finder-corner scan-finder-corner--tl" />
            <div className="scan-finder-corner scan-finder-corner--tr" />
            <div className="scan-finder-corner scan-finder-corner--bl" />
            <div className="scan-finder-corner scan-finder-corner--br" />
            <div className="scan-finder-line" />
          </div>
        )}

        {/* Instruction label */}
        {status === "idle" && scanning && (
          <div className="scan-instruction">
            <span>Point camera at QR pass</span>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="scan-camera-error-overlay">
            <span>📵</span>
            <p>{cameraError}</p>
            <button className="scan-retry-btn" onClick={startScanner}>Retry Camera</button>
          </div>
        )}
      </div>

      {/* Manual input bar (always visible at bottom if not showing sheet) */}
      {!showSheet && (
        <div className="scan-manual-bar">
          <input
            className="scan-manual-input"
            type="text"
            placeholder="Enter ticket code manually (BQF-XXXXXX)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") lookupCode(manualCode); }}
          />
          <button
            className="scan-manual-btn"
            onClick={() => lookupCode(manualCode)}
            disabled={!manualCode.trim() || status === "loading"}
          >
            →
          </button>
        </div>
      )}

      {/* ── Result bottom sheet ── */}
      {showSheet && (
        <div className={`scan-sheet scan-sheet--${status}`}>
          {/* Loading */}
          {status === "loading" && (
            <div className="scan-sheet-loading">
              <div className="scan-sheet-spinner" />
              <p>Checking in…</p>
            </div>
          )}

          {/* Invalid */}
          {status === "invalid" && (
            <div className="scan-sheet-body">
              <div className="scan-sheet-banner scan-sheet-banner--invalid">
                <span className="scan-sheet-icon">❌</span>
                <div>
                  <p className="scan-sheet-title">Invalid Ticket</p>
                  <p className="scan-sheet-sub">{errorMsg}</p>
                </div>
              </div>
              <button className="scan-sheet-action scan-sheet-action--reset" onClick={resetAndScan}>
                🔄 Scan Another
              </button>
            </div>
          )}

          {/* Already checked in — auto-dismisses in 2.5 s */}
          {status === "already_in" && attendee && (
            <div className="scan-sheet-body">
              <div className="scan-sheet-banner scan-sheet-banner--warning">
                <span className="scan-sheet-icon">⚠️</span>
                <div>
                  <p className="scan-sheet-title">Already Checked In</p>
                  <p className="scan-sheet-sub">
                    {attendee.checked_in_at
                      ? new Date(attendee.checked_in_at).toLocaleString("en-PH", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                      : "Previously checked in"}
                  </p>
                </div>
              </div>
              <div className="scan-sheet-name">{attendee.full_name}</div>
              <div className="scan-sheet-ticket">{attendee.ticket_code}</div>
              <div className="scan-countdown"><div className="scan-countdown__bar scan-countdown__bar--fast" /></div>
              <div className="scan-sheet-action-row scan-sheet-action-row--sticky">
                <button className="scan-sheet-action scan-sheet-action--reset" onClick={resetAndScan}>
                  🔄 Next Scan
                </button>
              </div>
            </div>
          )}

          {/* Success — auto-dismisses in 4 s */}
          {status === "success" && attendee && (
            <div className="scan-sheet-body scan-sheet-body--success">
              <div className="scan-sheet-success-icon">🎉</div>
              <p className="scan-sheet-success-title">CHECKED IN!</p>
              <div className="scan-sheet-name">{attendee.full_name}</div>
              <div className="scan-sheet-detail">{attendee.email}</div>
              <div className="scan-sheet-ticket">{attendee.ticket_code}</div>
              <div className="scan-countdown"><div className="scan-countdown__bar" /></div>
              <div className="scan-sheet-action-row scan-sheet-action-row--sticky">
                <button className="scan-sheet-action scan-sheet-action--next" onClick={resetAndScan}>
                  ➡ Next Scan
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
