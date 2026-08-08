# ⚡ BlockQuest Fiesta PH — Web Platform & Event Suite

A full-stack, responsive event management and interactive gaming portal built for **BlockQuest Fiesta PH** (Manila's premier Web3 developer summit). 

The suite provides end-to-end event operations—from attendee registration and instant QR entry pass generation to camera-based check-in scanners, admin analytics, and a gamified community questing experience.

---

## 🌟 Key Portals & Features

| Portal | Route | Description |
| :--- | :--- | :--- |
| **🏠 Hero Portal** | `/` | Glassmorphic launchpad with dynamic interactive choice cards leading to tickets or game. |
| **🎫 Ticket Desk** | `/register` | User registration form with instant QR entry pass (`BQF-XXXXXX`) generation and downloadable pass. |
| **⚡ BlockQuest Game** | `/zealy` | Mobile-first gamified questing app featuring daily quests, XP levelling, rewards, and leaderboard. |
| **📷 QR Scanner** | `/scan` | Live camera QR scanner (`html5-qrcode`) for event organizers & staff to check in attendees on-site. |
| **⚙️ Admin Console** | `/admin` | Real-time attendee dashboard, compact stat metrics, search/filter, live check-in stats, and quest management. |

---

## 🔥 Latest Updates & Highlights

- **🚀 Upgraded to Next.js 16 (Turbopack)**: Powered by Next.js 16.3, React 19, and the new `proxy.ts` request routing architecture.
- **📊 Compact Admin Dashboard (`/admin`)**: Sleek, single-row high-density stat cards display live stats (Total Attendees, Live Quests, Total XP Pool, Total Quests, and Checked In).
- **✨ Dark-Mode Glassmorphism Design System**: Modern visual hierarchy with glowing hover effects, HSL color tokens, custom typography, and responsive layouts across all viewports.
- **📷 Camera QR Scanner (`/scan`)**: Integrated `html5-qrcode` engine with live camera feed switching, audio/visual check-in feedback, and instantaneous Supabase verification.
- **🔒 Supabase SSR & Automatic Ticket Triggers**: Secure server-side authentication (`@supabase/ssr`), environment isolation, and automated database trigger (`trigger_set_ticket_code`) for generating collision-free `BQF-******` ticket codes upon registration.
- **🚀 One-Click Windows Launcher**: Added `start-project.bat` and `create-shortcut.vbs` for single-click execution that auto-launches the Next.js dev server and opens the browser.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router + Turbopack), React 19, TypeScript 5.9
- **Request Routing**: Next.js 16 `proxy.ts` architecture
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, `@supabase/ssr`, `@supabase/supabase-js`)
- **QR Code Engine**: `qrcode` (Generation) & `html5-qrcode` (Live Camera Scanning)
- **Styling**: Custom Glassmorphic Vanilla CSS Design System with dark mode primitives & micro-animations

---

## 📋 System Requirements for Smooth Execution

To ensure optimal performance, build reliability, and full camera/hardware API compatibility:

| Requirement | Recommended Version / Specification | Notes |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` (LTS) | Next.js 16 requires Node 18.18+ (Node 20+ recommended). |
| **npm** | `v10.x` or higher | Standard package manager shipped with Node LTS. |
| **Browser** | Chrome, Edge, Brave, Safari, Firefox | Modern evergreen browser with WebRTC & MediaDevices support. |
| **Camera Access** | HTTPS or `http://localhost` | Browser camera permission APIs for `/scan` require secure context. |
| **Database** | Supabase PostgreSQL | Active project with RLS & Service Role Key configured in `.env.local`. |

---

## 🚀 Installation & Setup Guide

### Step 1: Verify Prerequisites

Check your local Node.js and npm versions:
```bash
node -v   # Should output v20.x.x or v22.x.x
npm -v    # Should output 10.x.x or higher
```

### Step 2: Clone & Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd BlockQuestEvent

# Install node dependencies
npm install
```

### Step 3: Configure Environment Variables

Create your local environment file from the provided template:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

> **⚠️ Security Warning**: `SUPABASE_SERVICE_ROLE_KEY` has administrative privileges and bypasses RLS policies. Never commit this key or expose it to client-side bundles.

### Step 4: Setup Database Schema

Log in to your [Supabase Dashboard](https://database.new) and execute the SQL script in `schema.sql` inside the **SQL Editor**:

- Creates the `registrations` table.
- Sets up automatic ticket code generation (`BQF-******`).
- Installs indices for fast ticket and attendee search queries.

### Step 5: Run the Application

#### Development Mode:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Production Build:
```bash
npm run build
npm start
```

#### Option B: One-Click Windows Launcher
On Windows, double-click `start-project.bat` in the root folder. It will start the server and open the web portal automatically in your default browser.

---

## 📁 Project Directory Structure

```
BlockQuestEvent/
├── app/                      # Next.js App Router Pages & API Endpoints
│   ├── page.tsx              # Home / Portal Selection Screen
│   ├── register/             # Attendee Registration & Ticket Pass Page
│   ├── scan/                 # Live Camera QR Check-in Scanner
│   ├── admin/                # Event Admin Dashboard
│   ├── zealy/                # BlockQuest Mobile Game Page
│   └── api/                  # Server-side API Routes (Auth, QR Check-in, Admin)
├── components/               # Reusable React UI Components
│   ├── registration-form.tsx # Interactive Registration & Ticket Pass UI
│   ├── qr-scanner.tsx        # Camera scanning implementation
│   ├── zealy-mobile-app.tsx  # Gamified Quests & Leaderboard component
│   └── client-body-cleanup.tsx
├── public/                   # Static assets & brand logos
├── proxy.ts                  # Next.js 16 Request Proxy & Session Handler
├── schema.sql                # PostgreSQL database schema & trigger functions
├── start-project.bat         # One-click Windows startup script
├── create-shortcut.vbs       # Windows desktop shortcut generator script
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

---

## 📜 License

© 2026 BlockQuest. All rights reserved. Made with ❤️ for the Web3 Developer Community.