# ⚡ BlockQuest Fiesta PH — Web Platform & Event Suite

A full-stack, responsive event management, verification, and interactive gaming portal built for **BlockQuest Fiesta PH** (Manila's premier Web3 developer summit). 

The suite provides end-to-end event operations—from attendee registration with legal compliance and instant QR pass generation, to high-speed entrance scanners, sponsor booth engagement stations, proof verification queues, and a mobile-first gamified questing experience.

---

## 🌟 Key Portals & Features

| Portal | Route | Description |
| :--- | :--- | :--- |
| **🏠 Hero Portal** | `/` | Glassmorphic launchpad with interactive choice cards leading to tickets or game. |
| **🎫 Ticket Desk** | `/register` | Mobile-friendly registration form with dual-consent privacy compliance, social media gating, and instant QR entry pass (`BQF-XXXXXX`) generation. |
| **🎮 BlockQuest Game** | `/zealy` | Mobile-first gamified app featuring daily missions, trivia quizzes, passcodes, flash countdowns, locked quest chains, milestone badges, and live leaderboards. |
| **📷 Gate Entrance Scanner** | `/scan` | Live camera QR scanner (`html5-qrcode`) for gate staff to validate passes and check in attendees in milliseconds. |
| **🏪 Vendor Booth Scanner** | `/booth-scan` | Dedicated scanner for sponsor booths to award fixed XP (+150 XP) to attendees visiting stations with duplicate prevention. |
| **⚙️ Admin Dashboard** | `/admin` | Complete operational control center: metrics, paginated attendees, quest builder, verifier queue, booth scanner logs, and staff provisioning. |
| **🧭 Shortcut Hub** | `/shortcuts` | Central launcher bookmark for organizers, gate staff, and sponsors during live event operations. |
| **📖 Interactive Manual** | `/manual-presentation.html` | Rich visual presentation guide, operational playbooks, architecture diagrams, and real-world configuration examples. |

---

## 🔥 Key Highlights & Recent Upgrades

### 1. 🎯 Next-Gen Quest Engine
- **4 Verification Modes**:
  - **⚡ Instant Claim**: 1-click XP points without verification.
  - **📷 Screenshot Proof**: Attendees upload photos/screenshots; routed to the Verifier Queue for 1-click admin approval/rejection.
  - **❓ Trivia Quiz Question**: Attendees enter secret answers (case-insensitive) to claim XP automatically.
  - **🔑 Secret Passcode**: Attendees type a 4-to-8 character PIN revealed at sponsor booths or stage presentations.
- **⏱️ Time-Limited Flash Quests**: Configurable expiration timestamp (`expires_at`) with a live ticking countdown timer on mobile (`⏳ 14m 30s remaining`).
- **🔒 Prerequisite Quest Chains**: Quests can require completion of earlier quests (`depends_on_quest_id`) before unlocking.
- **🏆 Milestone Achievement Badges**: Unlocks dynamic tier badges in user profiles as XP grows (🥉 Rookie, 🥈 Explorer, 🥇 Master, 👑 Fiesta Legend).
- **✍️ 1-Click Quest Builder**: Includes 5 quick preset templates (Social Follow, Booth Passcode, Trivia Quiz, Stage Selfie, Instant Check-in), smart auto-slug ID generator, and a real-time live mobile preview.

### 2. 🛡️ Role-Based Access Control (RBAC)
Dedicated permissions across 6 operational staff roles:
- **👑 Superadmin**: Full system access, staff provisioning, quest editing, attendee management, and data exports.
- **💼 Event Manager**: Attendee check-in, quest management, and metric monitoring.
- **📷 Gate Scanner**: Access restricted to entrance QR scanning and manual search fallback.
- **🏪 Booth Staff**: Access restricted to `/booth-scan` station for logging attendee booth visits.
- **🔍 Quest Verifier**: Access restricted to the Quest Verifications queue to review and approve photo proof.
- **👁️ Viewer**: Read-only access to analytics and attendee lists.

### 3. 📋 Data Privacy & Dual-Consent Architecture
- Complies with Republic Act 10173 (Philippine Data Privacy Act).
- Explicit dual-consent checkboxes on registration:
  1. *Marketing & Sponsor Data Gathering Consent*
  2. *Terms of Service & RA 10173 Privacy Policy Consent*
- Both consent timestamps and boolean flags are persisted directly to PostgreSQL.

### 4. 📱 Mobile-First Operations & High-Density UI
- **Admin Mobile Tabs**: Compact, icon-first navigation designed for tablets and mobile devices on-site.
- **Attendees Pagination**: Smooth paginated table with 10, 20, 50, or 100 rows per page to prevent lag with thousands of attendees.
- **Compact Table Density**: Streamlined creator/editor timestamp tracking (`created_at`, `updated_at`).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router + Turbopack), React 19, TypeScript 5.9
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, `@supabase/ssr`, `@supabase/supabase-js`)
- **QR Code Engine**: `qrcode` (Generation) & `html5-qrcode` (Live Camera Scanning)
- **Styling**: Custom Glassmorphic Vanilla CSS Design System with dark mode primitives & micro-animations
- **Request Routing**: Next.js 16 `proxy.ts` architecture

---

## 🚀 Installation & Setup Guide

### Step 1: Verify Prerequisites
```bash
node -v   # Should output v20.x.x or v22.x.x
npm -v    # Should output 10.x.x or higher
```

### Step 2: Clone & Install Dependencies
```bash
git clone <repository-url>
cd BlockQuestEvent
npm install
```

### Step 3: Configure Environment Variables
Create `.env.local` from the template:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Step 4: Setup Database Schema
Execute the SQL script in `schema.sql` inside your [Supabase SQL Editor](https://database.new).

### Step 5: Run the Application

```bash
# Development Mode
npm run dev

# Production Build
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Directory Structure

```
BlockQuestEvent/
├── app/                        # Next.js App Router Pages & API Endpoints
│   ├── page.tsx                # Home / Portal Selection Screen
│   ├── register/               # Attendee Registration & Ticket Pass Page
│   ├── scan/                   # Live Camera QR Gate Check-in Scanner
│   ├── booth-scan/             # Sponsor Vendor Booth XP Scanner
│   ├── admin/                  # Event Admin Dashboard (6 modules)
│   ├── shortcuts/              # Event Operations Shortcut Hub
│   ├── zealy/                  # BlockQuest Gamified Web App
│   ├── stress-test/            # QA Load & Stress Testing Simulator
│   └── api/                    # Server-side API Endpoints (Auth, Quests, Scan, Admin)
├── components/                 # Reusable React UI Components
│   ├── registration-form.tsx   # Dual-Consent Registration Form & QR Pass UI
│   ├── qr-scanner.tsx          # Camera QR Scanner Engine
│   └── zealy-mobile-app.tsx    # Mobile Quest App, Leaderboard & Badges
├── public/                     # Static assets, brand logos, and presentation guides
│   ├── manual-presentation.html# Interactive Presentation Manual
│   └── assets/images/          # UI Screenshots & Assets
├── manual-presentation.html    # Master Platform Presentation & Playbook
├── schema.sql                  # PostgreSQL Schema, Triggers, & RLS Policies
├── start-project.bat           # 1-Click Windows Server Startup Script
└── README.md                   # Repository Documentation
```

---

## 📜 License

© 2026 BlockQuest. All rights reserved. Made with ❤️ for the Web3 Developer Community.