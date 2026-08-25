"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ShortcutsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 15%, rgba(59, 130, 246, 0.12) 0%, #05060b 80%)",
      color: "#f8fafc",
      fontFamily: "Outfit, Inter, system-ui, sans-serif",
      padding: "32px 20px 64px"
    }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        
        {/* Compact Header */}
        <header style={{
          textAlign: "center",
          marginBottom: 20,
          background: "rgba(13, 14, 25, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          padding: "16px 20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.3rem" }}>🧭</span>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
              Admin & Staff Navigation Central
            </h1>
            <span style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "rgba(245, 166, 35, 0.15)",
              color: "var(--gold-light)",
              border: "1px solid rgba(245, 166, 35, 0.3)",
              padding: "2px 8px",
              borderRadius: 20
            }}>
              Shortcut Hub
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", maxWidth: 680, margin: "0 auto", lineHeight: 1.4 }}>
            Quick launcher for all administrative consoles, mobile scanner gates, vendor stations, and QA test suites.
          </p>
        </header>

        {/* Shortcut Action Cards Grid (Responsive 4 in a row / 2x2 / 1-col) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
          marginBottom: 40
        }}>
          
          {/* Card 1: Admin Dashboard */}
          <div style={{
            background: "rgba(15, 16, 28, 0.85)",
            border: "1px solid rgba(245, 166, 35, 0.3)",
            borderRadius: 20,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #f5a623, #ffd166)"
            }} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(245, 166, 35, 0.15)",
                  border: "1px solid rgba(245, 166, 35, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem"
                }}>
                  🛡️
                </div>
                <span style={{
                  background: "rgba(245, 166, 35, 0.15)",
                  color: "var(--gold-light)",
                  border: "1px solid rgba(245, 166, 35, 0.4)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 800
                }}>
                  Superadmin / Manager
                </span>
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Admin Dashboard
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
                Full event control panel. Manage attendees, configure quests, approve proof verifications, provision staff, and monitor live booth metrics.
              </p>
            </div>
            <Link
              href="/admin"
              style={{
                display: "block",
                textAlign: "center",
                background: "linear-gradient(135deg, #f5a623 0%, #e69512 100%)",
                color: "#000",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 0 20px rgba(245, 166, 35, 0.3)"
              }}
            >
              Open /admin Dashboard →
            </Link>
          </div>

          {/* Card 2: Gate Entrance Scanner */}
          <div style={{
            background: "rgba(15, 16, 28, 0.85)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 20,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #3b82f6, #60a5fa)"
            }} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem"
                }}>
                  🎟️
                </div>
                <span style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 800
                }}>
                  Gate Staff
                </span>
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Gate Entrance Scanner
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
                Mobile-optimized camera QR scanner for venue entry. Instant check-in verification, audio chime confirmations, and ticket lookup fallback.
              </p>
            </div>
            <Link
              href="/gate-scan"
              style={{
                display: "block",
                textAlign: "center",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)"
              }}
            >
              Launch /gate-scan Scanner 📷
            </Link>
          </div>

          {/* Card 3: Booth Station Scanner */}
          <div style={{
            background: "rgba(15, 16, 28, 0.85)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: 20,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #a855f7, #c084fc)"
            }} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem"
                }}>
                  🏪
                </div>
                <span style={{
                  background: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  border: "1px solid rgba(168, 85, 247, 0.4)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 800
                }}>
                  Vendors & Sponsors
                </span>
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Vendor Booth Scanner
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
                Dedicated 1-time visit scanner for sponsor booths. Awards locked fixed XP scores (+150 XP) to attendees with duplicate claim prevention.
              </p>
            </div>
            <Link
              href="/booth-scan"
              style={{
                display: "block",
                textAlign: "center",
                background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)"
              }}
            >
              Launch /booth-scan Portal 🚀
            </Link>
          </div>

          {/* Card 4: Platform Manual & Presentation Guide */}
          <div style={{
            background: "rgba(15, 16, 28, 0.85)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 20,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #10b981, #34d399)"
            }} />
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem"
                }}>
                  📖
                </div>
                <span style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 800
                }}>
                  Documentation & Slides
                </span>
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Platform Manual & Presentation
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
                Interactive visual documentation guide. Includes full system architecture, operational workflows, quest configuration examples, and team playbooks.
              </p>
            </div>
            <a
              href="/manual-presentation.html"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)"
              }}
            >
              Open Manual & Presentation 📖 ↗
            </a>
          </div>

        </div>

        {/* Secondary Utility Links (Stress Test, Game, Registration, Manual) */}
        <div style={{
          background: "rgba(10, 11, 20, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20,
          padding: "24px"
        }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🛠️</span> Auxiliary Operations & Testing Links
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <a
              href="/manual-presentation.html"
              target="_blank"
              rel="noreferrer"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "14px 16px",
                borderRadius: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s"
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>📖</span>
              <div>
                <strong style={{ color: "#34d399", fontSize: "0.9rem", display: "block" }}>Platform Presentation</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/manual-presentation.html ↗</span>
              </div>
            </a>

            <Link
              href="/register"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "14px 16px",
                borderRadius: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s"
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🎫</span>
              <div>
                <strong style={{ color: "#fff", fontSize: "0.9rem", display: "block" }}>Attendee Registration</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/register</span>
              </div>
            </Link>

            <Link
              href="/zealy"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "14px 16px",
                borderRadius: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s"
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🎮</span>
              <div>
                <strong style={{ color: "#fff", fontSize: "0.9rem", display: "block" }}>BlockQuest Game</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/zealy</span>
              </div>
            </Link>

            <Link
              href="/"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "14px 16px",
                borderRadius: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s"
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🏠</span>
              <div>
                <strong style={{ color: "#fff", fontSize: "0.9rem", display: "block" }}>Public Home Portal</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>/</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ textAlign: "center", marginTop: 36, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          ⚡ <strong>BlockQuest Fiesta PH</strong> • Operations & Shortcut Hub • Bookmark <code>/shortcuts</code> for quick access
        </div>

      </div>
    </div>
  );
}
