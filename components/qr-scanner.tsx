"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

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

interface ScanResult {
  valid: boolean;
  already_checked_in?: boolean;
  attendee?: Attendee;
  message?: string;
  error?: string;
}

export default function QrScanner() {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);

  // ── Lookup a ticket code (preview, no check-in) ──────────────
  const lookupCode = useCallback(async (code: string) => {
    if (!code) return;
    setLookupLoading(true);
    setResult(null);
    setCheckInDone(false);
    try {
      const res = await fetch(`/api/admin/checkin?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      const json = await res.json();
      if (!res.ok) {
        setResult({ valid: false, error: json.error || "Ticket not found." });
      } else {
        setResult({ valid: true, attendee: json.attendee, already_checked_in: json.attendee?.checked_in });
      }
    } catch {
      setResult({ valid: false, error: "Network error. Try again." });
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // ── Confirm check-in (write to DB) ───────────────────────────
  const confirmCheckIn = useCallback(async () => {
    if (!result?.attendee?.ticket_code) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_code: result.attendee.ticket_code }),
      });
      const json = await res.json();
      setResult(json);
      setCheckInDone(true);
    } catch {
      setResult((prev) => prev ? { ...prev, error: "Check-in failed. Try again." } : null);
    } finally {
      setCheckingIn(false);
    }
  }, [result]);

  // ── Start camera QR scanner ───────────────────────────────────
  const startScanner = useCallback(async () => {
    setCameraError("");
    setResult(null);
    setCheckInDone(false);
    try {
      // Dynamically import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          // Pause after first successful scan
          scanner.pause();
          setScanning(false);
          // The QR code value is the ticket_code (e.g. BQF-XXXXXX)
          const code = decodedText.trim().toUpperCase();
          setManualCode(code);
          lookupCode(code);
        },
        () => {
          // ignore scan errors (no QR in frame yet)
        }
      );
      setScanning(true);
    } catch (err: any) {
      setCameraError(err?.message || "Camera access denied or unavailable.");
    }
  }, [lookupCode]);

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

  const resetScan = useCallback(async () => {
    setResult(null);
    setManualCode("");
    setCheckInDone(false);
    if (scannerRef.current) {
      try { await scannerRef.current.resume(); } catch {}
      setScanning(true);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="qr-scanner-panel">
      {/* Left: Camera */}
      <div className="qr-scanner-camera-col">
        <div className="qr-scanner-header">
          <h2 className="qr-scanner-title">QR Pass Scanner</h2>
          <p className="qr-scanner-hint">
            Point the camera at an attendee's QR pass or enter their ticket code manually.
          </p>
        </div>

        {/* Camera viewport */}
        <div className="qr-reader-container">
          <div id="qr-reader" className="qr-reader-box" />
          {!scanning && !result && (
            <div className="qr-reader-placeholder">
              <span className="qr-reader-icon">📷</span>
              <span>Camera not active</span>
            </div>
          )}
        </div>

        <div className="qr-scanner-camera-controls">
          {!scanning ? (
            <button className="qr-btn qr-btn--primary" onClick={startScanner}>
              📷 Start Camera Scanner
            </button>
          ) : (
            <button className="qr-btn qr-btn--danger" onClick={stopScanner}>
              ⏹ Stop Camera
            </button>
          )}
        </div>

        {cameraError && (
          <p className="qr-camera-error">⚠ {cameraError}</p>
        )}

        {/* Manual input */}
        <div className="qr-manual-input-row">
          <span className="qr-divider-label">— or enter manually —</span>
          <div className="qr-manual-input-group">
            <input
              type="text"
              className="qr-manual-input"
              placeholder="BQF-XXXXXX"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") lookupCode(manualCode); }}
            />
            <button
              className="qr-btn qr-btn--secondary"
              onClick={() => lookupCode(manualCode)}
              disabled={lookupLoading || !manualCode.trim()}
            >
              {lookupLoading ? "…" : "Look up"}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Result */}
      <div className="qr-scanner-result-col">
        {!result && !lookupLoading && (
          <div className="qr-result-empty">
            <span className="qr-result-empty__icon">🎫</span>
            <p>Scan or enter a ticket code to see the attendee's pass status.</p>
          </div>
        )}

        {lookupLoading && (
          <div className="qr-result-loading">
            <span className="qr-result-loading__spinner" />
            <p>Looking up ticket…</p>
          </div>
        )}

        {result && !lookupLoading && (
          <div className={`qr-result-card qr-result-card--${
            !result.valid ? "invalid" : checkInDone && !result.already_checked_in ? "success" : result.already_checked_in ? "warning" : "valid"
          }`}>
            {/* Status Banner */}
            <div className="qr-result-banner">
              {!result.valid ? (
                <>
                  <span className="qr-result-banner__icon">❌</span>
                  <div>
                    <p className="qr-result-banner__title">Invalid Ticket</p>
                    <p className="qr-result-banner__sub">{result.error || "Ticket code not found."}</p>
                  </div>
                </>
              ) : checkInDone && !result.already_checked_in ? (
                <>
                  <span className="qr-result-banner__icon">✅</span>
                  <div>
                    <p className="qr-result-banner__title">Checked In!</p>
                    <p className="qr-result-banner__sub">Welcome to BlockQuest Fiesta PH! 🎉</p>
                  </div>
                </>
              ) : result.already_checked_in ? (
                <>
                  <span className="qr-result-banner__icon">⚠️</span>
                  <div>
                    <p className="qr-result-banner__title">Already Checked In</p>
                    <p className="qr-result-banner__sub">
                      {result.attendee?.checked_in_at
                        ? `Checked in at ${new Date(result.attendee.checked_in_at).toLocaleString("en-PH")}`
                        : "This pass was already used."}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="qr-result-banner__icon">✔️</span>
                  <div>
                    <p className="qr-result-banner__title">Valid Pass</p>
                    <p className="qr-result-banner__sub">Ready for check-in</p>
                  </div>
                </>
              )}
            </div>

            {/* Attendee Details */}
            {result.attendee && (
              <div className="qr-result-details">
                <div className="qr-result-detail-row">
                  <span className="qr-result-label">Name</span>
                  <span className="qr-result-value qr-result-value--name">{result.attendee.full_name}</span>
                </div>
                <div className="qr-result-detail-row">
                  <span className="qr-result-label">Email</span>
                  <span className="qr-result-value">{result.attendee.email}</span>
                </div>
                <div className="qr-result-detail-row">
                  <span className="qr-result-label">Phone</span>
                  <span className="qr-result-value">{result.attendee.phone}</span>
                </div>
                {result.attendee.organization && (
                  <div className="qr-result-detail-row">
                    <span className="qr-result-label">Organization</span>
                    <span className="qr-result-value">{result.attendee.organization}</span>
                  </div>
                )}
                <div className="qr-result-detail-row">
                  <span className="qr-result-label">Ticket Code</span>
                  <span className="qr-result-value qr-result-value--code">{result.attendee.ticket_code}</span>
                </div>
                <div className="qr-result-detail-row">
                  <span className="qr-result-label">Registered</span>
                  <span className="qr-result-value qr-result-value--muted">
                    {new Date(result.attendee.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="qr-result-actions">
              {result.valid && !result.already_checked_in && !checkInDone && (
                <button
                  className="qr-btn qr-btn--checkin"
                  onClick={confirmCheckIn}
                  disabled={checkingIn}
                >
                  {checkingIn ? "Checking in…" : "✅ Confirm Check-In"}
                </button>
              )}
              <button className="qr-btn qr-btn--reset" onClick={resetScan}>
                🔄 Scan Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
