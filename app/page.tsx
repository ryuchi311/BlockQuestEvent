"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Footer from "../components/footer";

export default function Home() {
  const portalRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Constellation Particle Network Simulation
  useEffect(() => {
    const canvas = bgCanvasRef.current;
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

    const colors = [
      "#a855f7", // Electric Purple
      "#c084fc", // Soft Violet
      "#60a5fa", // Electric Blue
      "#f5a623", // Glowing Amber/Gold
      "#ffffff", // Pure White
    ];

    const particleCount = Math.min(Math.floor((width * height) / 16000), 75);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      color: string;
      alpha: number;
      baseAlpha: number;
      pulseSpeed: number;
      pulseOffset: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const baseRadius = Math.random() * 2.2 + 0.8;
      const baseAlpha = Math.random() * 0.5 + 0.35;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: baseRadius,
        baseRadius,
        color,
        alpha: baseAlpha,
        baseAlpha,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Draw constellation lines & polygon meshes
      const maxDistance = 140;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alphaFactor = 1 - dist / maxDistance;
            const lineAlpha = 0.22 * alphaFactor;

            const grad = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y
            );
            grad.addColorStop(0, particles[i].color);
            grad.addColorStop(1, particles[j].color);

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = grad;
            ctx.globalAlpha = lineAlpha;
            ctx.lineWidth = 0.85;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Translucent polygon meshes linking nearby triplets
            for (let k = j + 1; k < particles.length; k++) {
              const dx2 = particles[j].x - particles[k].x;
              const dy2 = particles[j].y - particles[k].y;
              const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

              const dx3 = particles[i].x - particles[k].x;
              const dy3 = particles[i].y - particles[k].y;
              const dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);

              if (dist2 < maxDistance * 0.75 && dist3 < maxDistance * 0.75) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.lineTo(particles[k].x, particles[k].y);
                ctx.closePath();
                ctx.fillStyle = "rgba(168, 85, 247, 0.025)";
                ctx.fill();
              }
            }
          }
        }
      }

      // Update & draw particles with natural pulsation & smooth boundary wrap
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Smooth boundary wrap
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Glowing pulsation
        const pulse = Math.sin(frameCount * p.pulseSpeed + p.pulseOffset);
        p.alpha = Math.max(0.15, p.baseAlpha + pulse * 0.25);
        p.radius = Math.max(0.5, p.baseRadius + pulse * 0.5);

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <main className="home-page">
      <canvas
        ref={bgCanvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
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

        <Footer />
      </section>
    </main>
  );
}
