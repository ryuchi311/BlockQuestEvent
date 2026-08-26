"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (localStorage.getItem("install_prompt_dismissed") === "true") {
      return;
    }

    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Delay prompt on iOS so it doesn't immediately block UI
      const timer = setTimeout(() => setShowPrompt(true), 2500);
      return () => clearTimeout(timer);
    }

    // Android/Chrome beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("install_prompt_dismissed", "true");
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "90px", // Sits above zealy tab bar
      left: "50%",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: "400px",
      background: "rgba(20, 20, 32, 0.95)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(245, 166, 35, 0.4)",
      borderRadius: "16px",
      padding: "16px",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      animation: "fadeInUp 0.5s ease"
    }}>
      <button onClick={dismiss} style={{ position: "absolute", top: "8px", right: "12px", background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", padding: "4px", cursor: "pointer" }}>
        ✕
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img src="/favicon.ico" alt="App Icon" style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }} />
        <div>
          <h4 style={{ margin: 0, fontSize: "1.05rem", color: "#fff", fontWeight: 800 }}>Install BlockQuest</h4>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            For a faster, full-screen native experience.
          </p>
        </div>
      </div>

      {isIOS ? (
        <div style={{ background: "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "10px", fontSize: "0.85rem", color: "#eee", lineHeight: 1.5 }}>
          Tap the <strong>Share</strong> icon <span style={{fontSize:"1.2rem", verticalAlign: "middle"}}>⍐</span> below, then scroll down and select <strong>"Add to Home Screen"</strong>.
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          style={{
            background: "var(--gold-light)",
            color: "#000",
            border: "none",
            borderRadius: "10px",
            padding: "12px",
            fontWeight: 800,
            fontSize: "0.95rem",
            cursor: "pointer",
            width: "100%"
          }}
        >
          Install App Now
        </button>
      )}
    </div>
  );
}
