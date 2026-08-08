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
| **⚙️ Admin Console** | `/admin` | Real-time attendee dashboard, search/filter, live check-in stats, manual check-in, and CSV export. |

---

## 🔥 Latest Updates & Highlights

- **✨ Dark-Mode Glassmorphism Design System**: Modern visual hierarchy with glowing hover effects, HSL color tokens, custom typography, and responsive layouts across all viewports.
- **📷 Camera QR Scanner (`/scan`)**: Integrated `html5-qrcode` engine with live camera feed switching, audio/visual check-in feedback, and instantaneous Supabase verification.
- **📊 Advanced Admin Dashboard (`/admin`)**: Interactive event stats (total registered, checked-in, pending), search by name/email/ticket code, manual ticket check-in overrides, and administrative export options.
- **⚡ Gamified Mobile App (`/zealy`)**: Complete quest completion system, real-time leaderboard rankings, XP progression bars, and claimable reward tiers.
- **🚀 One-Click Windows Launcher**: Added `start-project.bat` and `create-shortcut.vbs` for single-click execution that auto-launches the Next.js dev server and opens the browser.
- **🔒 Supabase SSR & Automatic Ticket Triggers**: Secure server-side authentication (`@supabase/ssr`), environment isolation, and automated database trigger (`trigger_set_ticket_code`) for generating collision-free `BQF-******` ticket codes upon registration.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, `@supabase/ssr`, `@supabase/supabase-js`)
- **QR Code Engine**: `qrcode` (Generation) & `html5-qrcode` (Live Camera Scanning)
- **Styling**: Custom Glassmorphic Vanilla CSS Design System with dark mode primitives & micro-animations

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Supabase**: Active Supabase project with PostgreSQL instance

### 2. Installation

```bash
git clone <repository-url>
cd BlockQuestEvent
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local` and set your credentials:

```bash
cp .env.example .env.local
```

Fill in the environment variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

> **⚠️ Important Security Note**: `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS rules. Keep it strictly in `.env.local` on the server and **never** expose or push it to client-side bundles.

### 4. Database Setup

Execute the included `schema.sql` script in your Supabase SQL Editor to create the `registrations` table and automated ticket code generator:

```sql
-- Creates registrations table & trigger set_ticket_code() for BQF-****** codes
-- See schema.sql in project root
```

### 5. Running the Application

#### Option A: Command Line
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Option B: One-Click Launcher (Windows)
Double-click `start-project.bat` in the project root. It will automatically start the server and open the app in your default browser.

---

## 📁 Project Directory Overview

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
├── schema.sql                # PostgreSQL database schema & trigger functions
├── start-project.bat         # One-click Windows startup script
├── create-shortcut.vbs       # Windows desktop shortcut generator script
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

---

## 📜 License

© 2026 BlockQuest. All rights reserved. Made with ❤️ for the Web3 Developer Community.