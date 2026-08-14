#!/usr/bin/env node

/**
 * ==============================================================================
 * BLOCKQUEST FIESTA PH - HIGH-CONCURRENCY STRESS & LOAD TESTING TOOL
 * ==============================================================================
 * Run from terminal:
 *   node stress-test.mjs [options]
 *
 * Options:
 *   --url=<baseUrl>       Target Base URL (default: http://localhost:3000)
 *   --concurrency=<num>   Number of concurrent worker threads (default: 20)
 *   --requests=<num>      Total requests per test suite (default: 100)
 *   --suite=<all|register|checkin|booth|admin> Target suite (default: all)
 * ==============================================================================
 */

import { performance } from 'perf_hooks';

// Parse CLI Arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.split('=');
  if (key.startsWith('--')) {
    acc[key.replace(/^--/, '')] = val || true;
  }
  return acc;
}, {});

const BASE_URL = (args.url || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = parseInt(args.concurrency || '20', 10);
const TOTAL_REQUESTS = parseInt(args.requests || '100', 10);
const TARGET_SUITE = args.suite || 'all';

console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│ 🚀 BLOCKQUEST FIESTA PH - SYSTEM STRESS & LOAD TEST SUITE              │
├────────────────────────────────────────────────────────────────────────┤
│ Target URL:   ${BASE_URL.padEnd(56)} │
│ Concurrency:  ${CONCURRENCY.toString().padEnd(56)} │
│ Total Reqs:   ${TOTAL_REQUESTS.toString().padEnd(56)} │
│ Target Suite: ${TARGET_SUITE.padEnd(56)} │
└────────────────────────────────────────────────────────────────────────┘
`);

// Percentile calculator helper
function calculatePercentiles(latencies) {
  if (!latencies.length) return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    mean: Math.round(sum / sorted.length),
    p50: Math.round(getP(0.50)),
    p90: Math.round(getP(0.90)),
    p95: Math.round(getP(0.95)),
    p99: Math.round(getP(0.99)),
  };
}

// Concurrent worker execution engine
async function runConcurrentBatch(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const res = await tasks[currentIndex]();
        results[currentIndex] = res;
      } catch (err) {
        results[currentIndex] = { success: false, status: 500, duration: 0, error: err.message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Single Request Runner Helper
async function executeRequest(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const duration = performance.now() - start;
    let body = null;
    try {
      body = await res.json();
    } catch {}

    return {
      success: res.ok,
      status: res.status,
      duration,
      body,
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      success: false,
      status: 0,
      duration,
      error: err.message,
    };
  }
}

// Format Suite Results
function printReport(suiteName, results, totalTimeMs) {
  const total = results.length;
  const successes = results.filter((r) => r.success).length;
  const failures = total - successes;
  const latencies = results.map((r) => r.duration);
  const stats = calculatePercentiles(latencies);
  const rps = ((total / totalTimeMs) * 1000).toFixed(2);
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n📊 RESULTS: ${suiteName}`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`  Total Requests:  ${total}`);
  console.log(`  Successful:      ${successes} (${((successes / total) * 100).toFixed(1)}%)`);
  console.log(`  Failed:          ${failures} (${((failures / total) * 100).toFixed(1)}%)`);
  console.log(`  Total Duration:  ${(totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`  Throughput:      ${rps} req/sec`);
  console.log(`  Latencies (ms):  Min: ${stats.min} | Mean: ${stats.mean} | Max: ${stats.max}`);
  console.log(`                   p50: ${stats.p50} | p90: ${stats.p90} | p95: ${stats.p95} | p99: ${stats.p99}`);
  console.log(`  Status Codes:    ${JSON.stringify(statusCodes)}`);
  console.log(`------------------------------------------------------------------------`);
}

// Main Test Suite Controller
async function main() {
  const registeredTickets = [];

  // ==========================================================================
  // SUITE 1: Attendees Registration Flow (POST /api/register)
  // ==========================================================================
  if (TARGET_SUITE === 'all' || TARGET_SUITE === 'register') {
    console.log(`\n▶ 1/4 Testing Registration Flow (POST /api/register)...`);
    const regTasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => {
      const id = Date.now() + i + Math.floor(Math.random() * 10000);
      const email = `stresstest_${id}@blockquest.ph`;
      return () =>
        executeRequest(`${BASE_URL}/api/register`, {
          method: 'POST',
          body: JSON.stringify({
            fullName: `Stress Tester ${i + 1}`,
            email,
            phone: `+63917${Math.floor(1000000 + Math.random() * 9000000)}`,
            organization: 'Stress Test Guild',
            password: 'testpassword2026',
            terms: true,
          }),
        }).then((res) => {
          if (res.success && res.body?.ticket_code) {
            registeredTickets.push(res.body.ticket_code);
          }
          return res;
        });
    });

    const startReg = performance.now();
    const regResults = await runConcurrentBatch(regTasks, CONCURRENCY);
    const endReg = performance.now() - startReg;
    printReport('Attendee Registrations', regResults, endReg);
  }

  // ==========================================================================
  // SUITE 2: Gate Entrance Check-In Flow (GET/POST /api/admin/checkin)
  // ==========================================================================
  if (TARGET_SUITE === 'all' || TARGET_SUITE === 'checkin') {
    console.log(`\n▶ 2/4 Testing Gate Entrance Check-In (POST /api/admin/checkin)...`);
    const sampleTickets = registeredTickets.length > 0
      ? registeredTickets
      : Array.from({ length: TOTAL_REQUESTS }, (_, i) => `BQF-STRESS${i}`);

    const checkinTasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => {
      const ticket = sampleTickets[i % sampleTickets.length];
      return () =>
        executeRequest(`${BASE_URL}/api/admin/checkin`, {
          method: 'POST',
          body: JSON.stringify({ ticket_code: ticket }),
        });
    });

    const startCheck = performance.now();
    const checkResults = await runConcurrentBatch(checkinTasks, CONCURRENCY);
    const endCheck = performance.now() - startCheck;
    printReport('Gate Entrance Check-Ins', checkResults, endCheck);
  }

  // ==========================================================================
  // SUITE 3: Vendor Booth Station XP Claim (POST /api/booth-scan)
  // ==========================================================================
  if (TARGET_SUITE === 'all' || TARGET_SUITE === 'booth') {
    console.log(`\n▶ 3/4 Testing Vendor Booth Station Visits (POST /api/booth-scan)...`);
    const booths = ['polygon-guild-booth', 'solana-superteam-ph', 'binance-academy', 'base-ecosystem'];
    const sampleTickets = registeredTickets.length > 0
      ? registeredTickets
      : Array.from({ length: TOTAL_REQUESTS }, (_, i) => `BQF-STRESS${i}`);

    const boothTasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => {
      const ticket = sampleTickets[i % sampleTickets.length];
      const booth = booths[i % booths.length];
      return () =>
        executeRequest(`${BASE_URL}/api/booth-scan`, {
          method: 'POST',
          body: JSON.stringify({
            ticket_code: ticket,
            booth_id: booth,
            points: 150,
          }),
        });
    });

    const startBooth = performance.now();
    const boothResults = await runConcurrentBatch(boothTasks, CONCURRENCY);
    const endBooth = performance.now() - startBooth;
    printReport('Vendor Booth Station Scans', boothResults, endBooth);
  }

  // ==========================================================================
  // SUITE 4: Dashboard API Polling & Real-Time Monitoring (GET /api/admin/users)
  // ==========================================================================
  if (TARGET_SUITE === 'all' || TARGET_SUITE === 'admin') {
    console.log(`\n▶ 4/4 Testing Admin Dashboard Data Polling (GET /api/admin/users & /api/leaderboard)...`);
    const adminTasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => {
      const endpoint = i % 2 === 0 ? '/api/admin/users' : '/api/leaderboard';
      return () => executeRequest(`${BASE_URL}${endpoint}`);
    });

    const startAdmin = performance.now();
    const adminResults = await runConcurrentBatch(adminTasks, CONCURRENCY);
    const endAdmin = performance.now() - startAdmin;
    printReport('Admin Dashboard Polling', adminResults, endAdmin);
  }

  console.log(`\n✅ STRESS TEST COMPLETE. System load evaluation finished successfully.\n`);
}

main().catch((err) => {
  console.error('Fatal Stress Test Error:', err);
  process.exit(1);
});
