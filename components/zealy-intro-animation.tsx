"use client";

import React, { useState, useEffect, useRef } from "react";

interface ZealyIntroAnimationProps {
  onComplete: () => void;
}

export default function ZealyIntroAnimation({ onComplete }: ZealyIntroAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING SECURE QUEST CORE...");
  const [isRevealing, setIsRevealing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Particle Field Canvas Simulation ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle nodes
    const particleCount = 45;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
    }> = [];

    const colors = ["#f5a623", "#ffd166", "#a855f7", "#3b82f6", "#ffffff"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.3,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw constellation connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(245, 166, 35, ${0.18 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // ── 5.5s Progress Timeline Sequence ──
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 1;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, 52);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress < 22) {
      setStatusText("ESTABLISHING SECURE QUEST NODE LINK...");
    } else if (progress < 48) {
      setStatusText("DECRYPTING SPONSOR BOOTH PROTOCOLS...");
    } else if (progress < 72) {
      setStatusText("SYNCHRONIZING GLOBAL LEADERBOARD & XP...");
    } else if (progress < 96) {
      setStatusText("CALIBRATING INTERACTIVE FIESTA ARENA...");
    } else {
      setStatusText("✦ FIESTA ARENA SYSTEM ONLINE ✦");
    }

    if (progress >= 100) {
      const revealTimeout = setTimeout(() => {
        setIsRevealing(true);
      }, 700);

      const finishTimeout = setTimeout(() => {
        setIsVisible(false);
        onComplete();
      }, 1500);

      return () => {
        clearTimeout(revealTimeout);
        clearTimeout(finishTimeout);
      };
    }
  }, [progress, onComplete]);

  const handleInstantSkip = () => {
    setIsRevealing(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 400);
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "radial-gradient(ellipse at center, rgba(13, 15, 26, 0.88) 0%, rgba(5, 6, 11, 0.95) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: "opacity 0.5s ease",
        opacity: isRevealing ? 0 : 1,
        pointerEvents: isRevealing ? "none" : "auto",
      }}
    >
      {/* ── Background Dynamic Particles Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.85,
        }}
      />

      {/* ── Giant Pulsing Nebula Ambient Core ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "650px",
          height: "650px",
          background: "radial-gradient(circle, rgba(245, 166, 35, 0.28) 0%, rgba(168, 85, 247, 0.18) 40%, rgba(59, 130, 246, 0.08) 60%, transparent 75%)",
          filter: "blur(80px)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 1,
          animation: "nebulaPulse 4s infinite ease-in-out",
        }}
      />

      {/* ── Luminous Light Burst ── */}
      {isRevealing && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "1200px",
            height: "1200px",
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 209, 102, 0.85) 15%, rgba(245, 166, 35, 0.5) 35%, rgba(168, 85, 247, 0.25) 55%, transparent 75%)",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 100,
            animation: "luminousLightBurst 0.8s ease-out forwards",
          }}
        />
      )}

      {/* ── Cyber HUD Corner Diagnostics & Telemetry ── */}
      <div style={{ position: "absolute", top: 22, left: 24, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399", display: "inline-block", animation: "blink 1.2s infinite" }} />
        <span style={{ color: "rgba(245, 166, 35, 0.8)", fontSize: "0.72rem", fontFamily: "monospace", letterSpacing: "2px", fontWeight: 700 }}>
          [ BQ-SYS.v2.6 ]
        </span>
      </div>

      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <button
          onClick={handleInstantSkip}
          style={{
            background: "rgba(245, 166, 35, 0.12)",
            border: "1px solid rgba(245, 166, 35, 0.45)",
            color: "var(--gold-light)",
            borderRadius: "20px",
            padding: "7px 16px",
            fontSize: "0.72rem",
            fontFamily: "monospace",
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: "1.5px",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 0 15px rgba(245, 166, 35, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(245, 166, 35, 0.25)";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(245, 166, 35, 0.12)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          SKIP INTRO ➔
        </button>
      </div>

      <div style={{ position: "absolute", bottom: 22, left: 24, zIndex: 10, color: "rgba(255, 255, 255, 0.35)", fontSize: "0.7rem", fontFamily: "monospace", letterSpacing: "1px" }}>
        OCTOBER 10, 2026 • CABUYAO CITY, PH
      </div>

      <div style={{ position: "absolute", bottom: 22, right: 24, zIndex: 10, color: "rgba(245, 166, 35, 0.6)", fontSize: "0.7rem", fontFamily: "monospace" }}>
        LATENCY: 14MS • 256-BIT SECURE
      </div>

      {/* ── Main Center Stage ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          zIndex: 5,
          padding: "24px",
          maxWidth: "460px",
          width: "100%",
        }}
      >
        {/* Holographic Multi-Ring Reactor Logo Rig */}
        <div
          style={{
            position: "relative",
            width: "180px",
            height: "180px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "30px",
          }}
        >
          {/* Ring 1: Outermost Expanding Plasma Shockwave */}
          <div
            style={{
              position: "absolute",
              inset: "-34px",
              borderRadius: "50%",
              border: "1px solid rgba(245, 166, 35, 0.35)",
              animation: "plasmaPulse 2.6s infinite ease-out",
            }}
          />

          {/* Ring 2: Rotating Cyber Orbital Track with Nodes */}
          <div
            style={{
              position: "absolute",
              inset: "-18px",
              borderRadius: "50%",
              border: "1.5px dashed rgba(255, 209, 102, 0.5)",
              animation: "spinClockwise 16s linear infinite",
            }}
          >
            <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#ffd166", boxShadow: "0 0 10px #ffd166" }} />
            <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#ffd166", boxShadow: "0 0 10px #ffd166" }} />
          </div>

          {/* Ring 3: Counter-rotating Electric Cyan Segmented HUD Ring */}
          <div
            style={{
              position: "absolute",
              inset: "-6px",
              borderRadius: "50%",
              border: "2px dotted rgba(59, 130, 246, 0.6)",
              animation: "spinCounterClockwise 10s linear infinite",
            }}
          />

          {/* Golden Reactor Core Box holding /logo.png */}
          <div
            style={{
              width: "136px",
              height: "136px",
              borderRadius: "34px",
              background: "linear-gradient(135deg, rgba(28, 24, 46, 0.96) 0%, rgba(10, 10, 20, 0.98) 100%)",
              border: "2px solid rgba(245, 166, 35, 0.85)",
              boxShadow: "0 0 55px rgba(245, 166, 35, 0.55), inset 0 0 30px rgba(245, 166, 35, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px",
              position: "relative",
              overflow: "hidden",
              animation: "floatCore 3.2s infinite ease-in-out",
            }}
          >
            {/* Laser Vertical Scanning Beam Sweep */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: "linear-gradient(90deg, transparent, #ffd166, #ffffff, #ffd166, transparent)",
                boxShadow: "0 0 12px #ffd166",
                animation: "laserScan 2.4s infinite ease-in-out",
                zIndex: 3,
              }}
            />

            {/* Glowing Corner Accents */}
            <div style={{ position: "absolute", top: 8, left: 8, width: 6, height: 6, borderTop: "2px solid #ffd166", borderLeft: "2px solid #ffd166" }} />
            <div style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderTop: "2px solid #ffd166", borderRight: "2px solid #ffd166" }} />
            <div style={{ position: "absolute", bottom: 8, left: 8, width: 6, height: 6, borderBottom: "2px solid #ffd166", borderLeft: "2px solid #ffd166" }} />
            <div style={{ position: "absolute", bottom: 8, right: 8, width: 6, height: 6, borderBottom: "2px solid #ffd166", borderRight: "2px solid #ffd166" }} />

            {/* Centered /logo.png */}
            <img
              src="/logo.png"
              alt="BlockQuest Logo"
              style={{
                width: "100px",
                height: "100px",
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px rgba(245, 166, 35, 0.8))",
                zIndex: 2,
              }}
            />
          </div>
        </div>

        {/* ── Subtitle Eyebrow ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ height: 1, width: 24, background: "linear-gradient(90deg, transparent, #f5a623)" }} />
          <p
            style={{
              color: "var(--gold)",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              margin: 0,
              textShadow: "0 0 14px rgba(245, 166, 35, 0.6)",
            }}
          >
            ✦ FIESTA QUEST GAME ✦
          </p>
          <span style={{ height: 1, width: 24, background: "linear-gradient(90deg, #f5a623, transparent)" }} />
        </div>

        {/* ── Main Glowing Title ── */}
        <h1
          style={{
            fontSize: "2.1rem",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            margin: "0 0 18px 0",
            background: "linear-gradient(135deg, #ffffff 0%, #ffd166 45%, #f5a623 85%, #ff8c00 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 20px rgba(245, 166, 35, 0.5))",
          }}
        >
          BlockQuest Arena
        </h1>

        {/* ── Active Soundwave Equalizer Bars ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, height: 16, marginBottom: 14 }}>
          {[0.4, 0.8, 0.3, 0.9, 0.6, 1.0, 0.7, 0.4, 0.85, 0.5, 0.75, 0.35].map((scale, i) => (
            <div
              key={i}
              style={{
                width: 3,
                background: "linear-gradient(180deg, #ffd166 0%, #f5a623 100%)",
                borderRadius: 2,
                boxShadow: "0 0 6px rgba(245, 166, 35, 0.8)",
                animation: `soundWave 0.8s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.08}s`,
                height: `${scale * 100}%`,
              }}
            />
          ))}
        </div>

        {/* ── Segmented Neon Power Charge Bar ── */}
        <div style={{ width: "100%", maxWidth: "300px", marginBottom: "14px" }}>
          <div
            style={{
              height: "8px",
              width: "100%",
              background: "rgba(255, 255, 255, 0.06)",
              borderRadius: "99px",
              overflow: "hidden",
              border: "1px solid rgba(245, 166, 35, 0.3)",
              boxShadow: "inset 0 0 10px rgba(0,0,0,0.8), 0 0 16px rgba(245, 166, 35, 0.2)",
              position: "relative",
              padding: "1px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #3b82f6 0%, #f5a623 40%, #ffd166 80%, #ffffff 100%)",
                boxShadow: "0 0 20px rgba(245, 166, 35, 1), 0 0 35px rgba(255, 209, 102, 0.8)",
                borderRadius: "inherit",
                transition: "width 0.05s ease-out",
                position: "relative",
              }}
            >
              {/* Charge Pulse Tip */}
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, background: "#ffffff", borderRadius: "50%", boxShadow: "0 0 12px #ffffff" }} />
            </div>
          </div>
        </div>

        {/* ── Live Telemetry Status & Glowing Percentage ── */}
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: "300px", alignItems: "center" }}>
          <p
            style={{
              color: progress >= 100 ? "#34d399" : "var(--text-secondary)",
              fontSize: "0.72rem",
              fontFamily: "monospace",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.04em",
              textShadow: progress >= 100 ? "0 0 8px #34d399" : "none",
            }}
          >
            {statusText}
          </p>
          <span
            style={{
              color: "var(--gold-light)",
              fontSize: "0.85rem",
              fontFamily: "monospace",
              fontWeight: 900,
              textShadow: "0 0 10px rgba(245, 166, 35, 0.8)",
            }}
          >
            {progress}%
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes plasmaPulse {
          0% {
            transform: scale(0.92);
            opacity: 0.8;
          }
          50% {
            opacity: 0.4;
          }
          100% {
            transform: scale(1.65);
            opacity: 0;
          }
        }
        @keyframes spinClockwise {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spinCounterClockwise {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        @keyframes floatCore {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1deg);
          }
        }
        @keyframes laserScan {
          0% {
            top: 0%;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes nebulaPulse {
          0%, 100% {
            opacity: 0.75;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.15);
          }
        }
        @keyframes blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        @keyframes soundWave {
          0% {
            height: 20%;
          }
          100% {
            height: 100%;
          }
        }
        @keyframes luminousLightBurst {
          0% {
            transform: translate(-50%, -50%) scale(0.1);
            opacity: 0;
            filter: brightness(2) blur(5px);
          }
          35% {
            transform: translate(-50%, -50%) scale(0.95);
            opacity: 1;
            filter: brightness(2.5) blur(12px);
          }
          100% {
            transform: translate(-50%, -50%) scale(1.6);
            opacity: 0;
            filter: brightness(1) blur(35px);
          }
        }
      `}</style>
    </div>
  );
}
