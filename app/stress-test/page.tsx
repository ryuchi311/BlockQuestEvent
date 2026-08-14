"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface TestLog {
  id: string;
  time: string;
  endpoint: string;
  status: number;
  duration: number;
  success: boolean;
  message?: string;
}

interface TestMetrics {
  total: number;
  success: number;
  failed: number;
  tps: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
}

export default function StressTestGuidePage() {
  const [mounted, setMounted] = useState(false);
  const [testing, setTesting] = useState(false);
  const [targetEndpoint, setTargetEndpoint] = useState<"all" | "register" | "checkin" | "booth" | "leaderboard">("all");
  const [concurrency, setConcurrency] = useState<number>(10);
  const [totalRequests, setTotalRequests] = useState<number>(50);

  const [logs, setLogs] = useState<TestLog[]>([]);
  const [metrics, setMetrics] = useState<TestMetrics>({
    total: 0,
    success: 0,
    failed: 0,
    tps: 0,
    avgLatency: 0,
    minLatency: 0,
    maxLatency: 0,
    p95Latency: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addLog = (log: TestLog) => {
    setLogs((prev) => [log, ...prev.slice(0, 99)]);
  };

  const stopStressTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setTesting(false);
  };

  const runStressTest = async () => {
    if (testing) return;
    setTesting(true);
    setLogs([]);
    setMetrics({
      total: 0,
      success: 0,
      failed: 0,
      tps: 0,
      avgLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      p95Latency: 0,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = performance.now();
    const latencies: number[] = [];
    let successCount = 0;
    let failCount = 0;

    const generateTask = (index: number) => {
      const timestamp = new Date().toLocaleTimeString();
      const randomId = Math.floor(1000 + Math.random() * 9000);
      let url = "/api/leaderboard";
      let method = "GET";
      let body: any = null;

      const selected = targetEndpoint === "all"
        ? (["register", "checkin", "booth", "leaderboard"] as const)[index % 4]
        : targetEndpoint;

      if (selected === "register") {
        url = "/api/register";
        method = "POST";
        body = JSON.stringify({
          fullName: `Stress User ${index + 1}`,
          email: `browser_stress_${Date.now()}_${randomId}@blockquest.ph`,
          phone: `+63917${Math.floor(1000000 + Math.random() * 9000000)}`,
          organization: "Stress Test Suite",
          password: "password2026",
          terms: true,
        });
      } else if (selected === "checkin") {
        url = "/api/admin/checkin";
        method = "POST";
        body = JSON.stringify({ ticket_code: `BQF-TEST-${randomId}` });
      } else if (selected === "booth") {
        url = "/api/booth-scan";
        method = "POST";
        body = JSON.stringify({
          ticket_code: `BQF-BOOTH-${randomId}`,
          booth_id: "polygon-guild-booth",
          points: 150,
        });
      } else {
        url = index % 2 === 0 ? "/api/leaderboard" : "/api/admin/users";
        method = "GET";
      }

      return async () => {
        if (controller.signal.aborted) return;
        const reqStart = performance.now();
        try {
          const res = await fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body,
            signal: controller.signal,
          });
          const duration = Math.round(performance.now() - reqStart);
          latencies.push(duration);

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }

          addLog({
            id: `${index}-${Date.now()}`,
            time: timestamp,
            endpoint: `${method} ${url}`,
            status: res.status,
            duration,
            success: res.ok,
          });
        } catch (err: any) {
          if (err.name === "AbortError") return;
          const duration = Math.round(performance.now() - reqStart);
          latencies.push(duration);
          failCount++;
          addLog({
            id: `${index}-${Date.now()}`,
            time: timestamp,
            endpoint: `${method} ${url}`,
            status: 0,
            duration,
            success: false,
            message: err.message,
          });
        }

        // Update live aggregate metrics
        const totalDone = successCount + failCount;
        const elapsedSec = (performance.now() - startTime) / 1000;
        const sorted = [...latencies].sort((a, b) => a - b);
        const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 0;

        setMetrics({
          total: totalDone,
          success: successCount,
          failed: failCount,
          tps: elapsedSec > 0 ? parseFloat((totalDone / elapsedSec).toFixed(1)) : 0,
          avgLatency: avg,
          minLatency: sorted[0] || 0,
          maxLatency: sorted[sorted.length - 1] || 0,
          p95Latency: p95,
        });
      };
    };

    const tasks = Array.from({ length: totalRequests }, (_, i) => generateTask(i));
    let index = 0;

    const worker = async () => {
      while (index < tasks.length && !controller.signal.aborted) {
        const currentTask = tasks[index++];
        await currentTask();
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);

    setTesting(false);
  };

  if (!mounted) return null;

  return (
    <div style={{ background: "#05060b", color: "#f8fafc", minHeight: "100vh", fontFamily: "Outfit, Inter, sans-serif" }}>
      {/* Top Header Navigation */}
      <header style={{
        background: "rgba(13, 14, 25, 0.95)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f5a623 0%, #3b82f6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.3rem",
            boxShadow: "0 0 20px rgba(245, 166, 35, 0.3)"
          }}>
            ⚡
          </div>
          <div>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff" }}>
              System Stress & High-Concurrency Load Suite
            </h1>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              BlockQuest Event Platform • Live API Benchmarks & High-Traffic Architecture Guide
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/admin" style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: "0.82rem",
            fontWeight: 700,
            textDecoration: "none"
          }}>
            ← Admin Dashboard
          </Link>
          <Link href="/" style={{
            background: "linear-gradient(135deg, #f5a623 0%, #e69512 100%)",
            color: "#000",
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: "0.82rem",
            fontWeight: 800,
            textDecoration: "none"
          }}>
            Home Portal ↗
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 64px" }}>
        
        {/* Section 1: Live Interactive Benchmark Console */}
        <section style={{ marginBottom: 48 }}>
          <div style={{
            background: "rgba(15, 16, 28, 0.8)",
            border: "1px solid rgba(245, 166, 35, 0.25)",
            borderRadius: 20,
            padding: "24px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f5a623" }}>
                  Interactive Simulator
                </span>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", marginTop: 2 }}>
                  Live API Load & Concurrency Benchmark
                </h2>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {!testing ? (
                  <button
                    onClick={runStressTest}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "10px 24px",
                      borderRadius: 10,
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)"
                    }}
                  >
                    🚀 Run Live Stress Test
                  </button>
                ) : (
                  <button
                    onClick={stopStressTest}
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.5)",
                      color: "#f87171",
                      padding: "10px 24px",
                      borderRadius: 10,
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    ⏹ Stop Benchmark
                  </button>
                )}
              </div>
            </div>

            {/* Test Configuration Controls */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              background: "rgba(0, 0, 0, 0.3)",
              padding: 16,
              borderRadius: 14,
              border: "1px solid rgba(255, 255, 255, 0.05)",
              marginBottom: 24
            }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Target Endpoint Suite:
                </label>
                <select
                  value={targetEndpoint}
                  onChange={(e: any) => setTargetEndpoint(e.target.value)}
                  disabled={testing}
                  style={{ width: "100%", padding: "8px 12px", background: "#121320", color: "#fff", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <option value="all">⚡ All Workflows (Mixed Load)</option>
                  <option value="register">📝 Attendee Registrations (/api/register)</option>
                  <option value="checkin">🎟️ Gate Check-Ins (/api/admin/checkin)</option>
                  <option value="booth">🏪 Booth Station Scans (/api/booth-scan)</option>
                  <option value="leaderboard">📊 Leaderboard & Stats (/api/leaderboard)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Concurrency (Simulated Staff Workers): <strong style={{ color: "#f5a623" }}>{concurrency}</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  disabled={testing}
                  style={{ width: "100%", accentColor: "#f5a623" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Total Requests Batch Size: <strong style={{ color: "#3b82f6" }}>{totalRequests}</strong>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={10}
                  value={totalRequests}
                  onChange={(e) => setTotalRequests(Number(e.target.value))}
                  disabled={testing}
                  style={{ width: "100%", accentColor: "#3b82f6" }}
                />
              </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Total Processed</span>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", marginTop: 2 }}>{metrics.total} / {totalRequests}</p>
              </div>
              <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: 14, borderRadius: 12, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <span style={{ fontSize: "0.72rem", color: "#10b981" }}>Success Rate</span>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "#10b981", marginTop: 2 }}>
                  {metrics.total > 0 ? `${Math.round((metrics.success / metrics.total) * 100)}%` : "100%"}
                </p>
              </div>
              <div style={{ background: "rgba(59, 130, 246, 0.05)", padding: 14, borderRadius: 12, border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <span style={{ fontSize: "0.72rem", color: "#60a5fa" }}>Throughput (TPS)</span>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "#60a5fa", marginTop: 2 }}>{metrics.tps} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>req/s</span></p>
              </div>
              <div style={{ background: "rgba(168, 85, 247, 0.05)", padding: 14, borderRadius: 12, border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                <span style={{ fontSize: "0.72rem", color: "#c084fc" }}>Average Latency</span>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "#c084fc", marginTop: 2 }}>{metrics.avgLatency} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>ms</span></p>
              </div>
              <div style={{ background: "rgba(245, 166, 35, 0.05)", padding: 14, borderRadius: 12, border: "1px solid rgba(245, 166, 35, 0.2)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--gold-light)" }}>p95 Latency</span>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--gold-light)", marginTop: 2 }}>{metrics.p95Latency} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>ms</span></p>
              </div>
            </div>

            {/* Real-time Console Log */}
            <div style={{
              background: "#080912",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 12,
              padding: 14,
              height: 220,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "0.8rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span>LIVE REQUEST STREAM</span>
                <span>STATUS / LATENCY</span>
              </div>
              {logs.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 60 }}>
                  Ready to test. Click "Run Live Stress Test" above to start sending concurrent API benchmarks.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <span style={{ color: log.success ? "#94a3b8" : "#f87171" }}>
                      [{log.time}] <strong style={{ color: "#fff" }}>{log.endpoint}</strong>
                    </span>
                    <div>
                      <span style={{
                        background: log.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: log.success ? "#34d399" : "#f87171",
                        padding: "2px 6px",
                        borderRadius: 4,
                        marginRight: 8,
                        fontWeight: 700
                      }}>
                        {log.status || "ERR"}
                      </span>
                      <span style={{ color: "var(--gold-light)" }}>{log.duration}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Section 2: High-Concurrency System Guide & Architecture */}
        <section>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3b82f6" }}>
              Event-Day Readiness Documentation
            </span>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, color: "#fff", marginTop: 4 }}>
              High-Concurrency Architecture & Load Guide
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: 700, margin: "8px auto 0", fontSize: "0.95rem" }}>
              Detailed blueprint for scaling BlockQuest Fiesta PH to handle thousands of concurrent attendee check-ins and vendor booth visits.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
            
            {/* Guide Card 1 */}
            <div style={{ background: "rgba(15, 16, 28, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: "1.5rem" }}>⚡</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>1. Command Line CLI Stress Testing</h3>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
                You can run native multithreaded load tests directly from your terminal using the project's custom test engine or Autocannon.
              </p>
              <div style={{ background: "#080912", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14, fontFamily: "monospace", fontSize: "0.8rem", color: "#60a5fa", overflowX: "auto" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 6 }}># Run standard project stress test (20 workers, 100 requests)</div>
                npm run stress-test<br /><br />
                <div style={{ color: "var(--text-muted)", marginBottom: 6 }}># Custom target URL & higher concurrency</div>
                node stress-test.mjs --url=https://event.chiprojects.com --concurrency=50 --requests=500 --suite=all
              </div>
            </div>

            {/* Guide Card 2 */}
            <div style={{ background: "rgba(15, 16, 28, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: "1.5rem" }}>🐘</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>2. Supabase Connection Pooling (pgBouncer)</h3>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                During high-density gate entrance hours, multiple gate devices scan tickets simultaneously. Use Supabase Transaction Pooler.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.7, paddingLeft: 18 }}>
                <li><strong>Port 6543 (pgBouncer)</strong>: Use Transaction Pooling mode to prevent connection exhaustion.</li>
                <li><strong>Max Client Connections</strong>: Increase to 200+ pool size in Supabase Database settings for 5,000+ attendee events.</li>
                <li><strong>Database Indexing</strong>: Ensure indexes exist on <code>registrations(ticket_code)</code> and <code>quest_completions(quest_id, registration_id)</code>.</li>
              </ul>
            </div>

            {/* Guide Card 3 */}
            <div style={{ background: "rgba(15, 16, 28, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: "1.5rem" }}>🔒</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>3. Atomic Concurrency Lock Guards</h3>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                Preventing double-claim attacks when attendees scan rapidly across multiple vendor booths or gate entrances.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.7, paddingLeft: 18 }}>
                <li><strong>Atomic Check-In Lock</strong>: <code>checked_in</code> boolean updates enforce single-entrance check-in across 5 concurrent gates.</li>
                <li><strong>Unique Receipt Constraint</strong>: Unique composite key on <code>quest_completions(quest_id, registration_id)</code> ensures 1-time booth visit scoring.</li>
                <li><strong>Dual-Layer Session Protection</strong>: Ephemeral <code>sessionStorage</code> purges tokens when closing browser tabs.</li>
              </ul>
            </div>

            {/* Guide Card 4 */}
            <div style={{ background: "rgba(15, 16, 28, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: "1.5rem" }}>🏎️</span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>4. Production Edge & CDN Caching</h3>
              </div>
              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                Optimizing static assets and API routes for sub-100ms response times globally.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.7, paddingLeft: 18 }}>
                <li><strong>Static Generation (SSG)</strong>: Portal landing page, registration form, and booth scanner views build statically.</li>
                <li><strong>Optimized Node.js Runtime</strong>: API routes operate under Node.js runtime for full cryptographic `scryptSync` speed.</li>
                <li><strong>Offline Client QR Fallback</strong>: Attendees can present offline QR pass screenshots without cellular data.</li>
              </ul>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
