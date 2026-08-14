# 🚀 BlockQuest Fiesta PH — Comprehensive Project Guide & Operations Manual

Welcome to **BlockQuest Fiesta PH**, a full-stack Next.js event platform built for interactive attendee registration, QR ticket pass generation, quest game arena (Zealy-style), and real-time administrator operations (check-in scanner & proof verification).

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [Key Features](#-key-features)
4. [Project Structure & Routes](#-project-structure--routes)
5. [Getting Started & Local Setup](#-getting-started--local-setup)
6. [Environment Variables](#-environment-variables)
7. [Database Setup & Supabase Schema](#-database-setup--supabase-schema)
8. [Admin Portal Credentials & Seeding](#-admin-portal-credentials--seeding)
9. [User Journeys & Features Breakdown](#-user-journeys--features-breakdown)
   - [Attendee Registration & Social Gated QR Pass](#1-attendee-registration--social-gated-qr-pass)
   - [On-Site Mobile QR Check-In Scanner](#2-on-site-mobile-qr-check-in-scanner)
   - [Admin Portal & Management Dashboard](#3-admin-portal--management-dashboard)
   - [Quest Game Arena (Zealy-Style) & Verification](#4-quest-game-arena-zealy-style--verification)
10. [High Concurrency & Event Day Capacity](#-high-concurrency--event-day-capacity)
11. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Project Overview

BlockQuest Fiesta PH is designed to handle **600+ concurrent attendees** during live event day operations at CABS Cabuyao City. It includes:
- **Registration Hub**: Quick guest registration with instant account login and phone number formatting (`+63`).
- **Social Media Mission Gating**: 10-second auto-verification countdowns requiring attendees to follow official channels (Facebook, Telegram, X) before claiming their QR pass. (4 social missions in total).
- **Mobile QR Pass Scanner**: Fullscreen mobile-optimized scanner with audio feedback (victory jingles), haptic vibration, auto-check-in, and duplicate ticket detection.
- **Quest Arena**: Quests with instant XP claims or screenshot proof submissions.
- **Admin Dashboard**: Multi-role admin management with CSV export, search/filtering, quest draft/live toggling, screenshot proof image zoom/pan, and rejection reason logging.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router) with Turbopack
- **Language**: TypeScript & React 19
- **Styling**: Vanilla CSS with custom glassmorphism design system (`app/globals.css`)
- **Database & Storage**: Supabase (PostgreSQL & Supabase Storage Bucket)
- **Authentication**: Custom Hashed Admin Auth & Event Session Persistence
- **QR Code & Scanner**: `qrcode` & `html5-qrcode`
- **Audio & Haptics**: Web Audio API (Synthesized C5-C6 victory jingles) & HTML5 Vibration API

---

## 🛣 Project Structure & Routes

### User-Facing Pages
| Route | Description |
| :--- | :--- |
| `/` | Landing page highlighting event schedule, speakers, partners, and fiesta details |
| `/register` | Registration form & ticket portal with social gated QR Pass claim |
| `/zealy` | BlockQuest Game Arena (Leaderboard, Quests, Profile, Ticket Pass) |
| `/scan` | Standalone Mobile QR Code Scanner for event gate check-in |
| `/admin` | Admin Portal (Attendees, Fiesta Quests, Quest Verifications, Scanner) |

### API Routes
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/register` | `POST` | Registers a new attendee in Supabase `registrations` table |
| `/api/login` | `POST` | Authenticates returning attendees using Email & Phone |
| `/api/qr-pass` | `POST` | Generates unique ticket code (`BQF-XXXXXX`) & base64 QR code |
| `/api/admin/login` | `POST` | Admin authentication endpoint |
| `/api/admin/attendees` | `GET` | Fetches registered attendees |
| `/api/admin/checkin` | `POST` | Checks in an attendee by ticket code |
| `/api/admin/quests` | `GET`, `POST`, `PATCH`, `DELETE` | CRUD operations for Fiesta Event Quests |
| `/api/admin/verifications` | `GET`, `POST`, `PATCH` | Submits and reviews quest proof screenshot verifications |

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- Node.js `v18.x` or higher
- npm or yarn

### 2. Installation
```bash
# Clone the repository and navigate into project directory
cd BlockQuestEvent

# Install dependencies
npm install
```

### 3. Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Building for Production
```bash
npm run build
npm run start
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Supabase Storage Bucket for Quest Screenshot Proofs
SUPABASE_STORAGE_BUCKET=blockquestbucket

# Admin Auth Secret
ADMIN_JWT_SECRET=your_admin_secret_key_2026
```

---

## 🗄 Database Setup & Supabase Schema

Execute the SQL script in `schema.sql` inside your Supabase SQL Editor:

```sql
-- 1. Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    organization TEXT,
    ticket_code TEXT UNIQUE,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    agreed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fiesta Event Quests Table
CREATE TABLE IF NOT EXISTS public.fiesta_event_quests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    xp INTEGER DEFAULT 100,
    status TEXT DEFAULT 'Soon', -- Live, Soon, Done, Draft
    category TEXT DEFAULT 'onboarding', -- onboarding, social, daily
    action_label TEXT,
    action_url TEXT,
    requires_proof BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 99,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Quest Verifications Table
CREATE TABLE IF NOT EXISTS public.quest_verifications (
    id SERIAL PRIMARY KEY,
    quest_id TEXT NOT NULL,
    quest_title TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    ticket_code TEXT,
    xp INTEGER NOT NULL,
    proof_url TEXT NOT NULL,
    status TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin', -- superadmin, admin, verifier, manage_quester, viewer
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔑 Admin Portal Credentials & Seeding

To seed the initial Superadmin account into your database:

```bash
node seed_admin.mjs
```

### Default Credentials:
- **Email**: `admin@blockquest.com`
- **Password**: `blockquest2026`
- **Role**: `superadmin`

---

## 🛡️ Role-Based Access Control (RBAC) Guide

The admin portal supports multiple roles to securely delegate tasks during the event. A `superadmin` can create and assign these roles to staff members.

### Available Roles
1. **`superadmin`**: Full access. Can create/delete quests, publish drafts, export attendees, and manage other admins.
2. **`admin` (Manager)**: Broad access. Can check in users, edit quests, and verify proofs, but cannot delete quests or export data.
3. **`verifier`**: Restricted to the **Quest Verifications** tab. Their primary job is to approve or reject submitted screenshot proofs rapidly during peak hours.
4. **`manage_attendees` (Scanner & Attendees)**: Restricted to the **Scanner** and **Event Pass Attendees** tabs. Their primary job is to scan QR codes and manually check in attendees at the physical event gate.
5. **`viewer`**: Read-only access across the dashboard. Cannot modify any data.

### How a Superadmin Creates Roles
Superadmins can add, edit, and assign roles directly from the **Staff / Admins** tab in the dashboard, or via database / scripts:

1. **Option A: Admin Dashboard UI (Recommended)**
   Go to the **Staff / Admins** tab and use the Create / Edit Admin forms to assign roles (`superadmin`, `admin`, `manage_attendees`, `verifier`, `viewer`).
2. **Option B: Modify the Seed Script**
   Update `seed_admin.mjs` with the new user's email and preferred role (`verifier`, `manage_attendees`, etc.), then execute the script.
3. **Option C: Supabase Dashboard**
   - Go to your Supabase project dashboard -> Table Editor -> `admin_users`.
   - Insert a new row or edit an existing user's `role` column to the desired string (e.g., `manage_attendees`).

> [!TIP]
> **Security Best Practice:** Do not share the `superadmin` account. Instead, create dedicated `verifier` accounts for staff approving quests, and `manage_attendees` accounts for staff working the check-in gates.

---

## 📖 User Journeys & Features Breakdown

### 1. Attendee Registration & Social Gated QR Pass
- Attendees register with Name, Email, Phone Number, and optional Organization.
- Returning attendees can click **"Already registered? Unlock QR Pass"** to log in using their Email & Phone.
- **Social Media Mission Gate**: Before generating the QR pass, attendees are prompted to complete 4 social follow missions:
  - 🌐 **Facebook**: [https://www.facebook.com/BRGYTamago](https://www.facebook.com/BRGYTamago)
  - ✈️ **Telegram Channel**: [https://t.me/block_quest](https://t.me/block_quest)
  - ✈️ **Telegram Group**: [https://t.me/+YG918_es6Es0Mjc1](https://t.me/+YG918_es6Es0Mjc1)
  - 🐦 **Twitter / X**: [https://x.com/BRGYTamago](https://x.com/BRGYTamago)
- Each button triggers a **10-second countdown fake auto-verification timer** (`⏳ Verifying 10s...`) before marking the task `✓ Verified`. Once all 4 are completed, the QR pass unlocks.

### 2. On-Site Mobile QR Check-In Scanner (`/scan`)
- Framed in a **Mobile Shell** on desktop screens and full-screen camera on actual mobile devices.
- Uses camera QR scanning or manual ticket code lookup (`BQF-XXXXXX`).
- Plays a **4-note Web Audio API C5→C6 victory jingle** and triggers haptic vibrations upon successful check-in.
- Detects already checked-in tickets and displays timestamp warnings.

### 3. Admin Portal & Management Dashboard (`/admin`)
- **Event Pass Attendees**: Real-time attendee list, search bar, check-in status filters, manual check-in button, and CSV export.
- **Fiesta Event Quests**: Add/edit quests with real-time preview card, draft saving, order sorting, status toggles, and rich multi-line description formatting with +Bullet / +Numbered list buttons.
- **Quest Verifications**: Review user screenshot proof submissions with interactive **Zoom & Pan image modal**, single-click Approval (+XP award), or Rejection with custom reason tracking.

### 4. Quest Game Arena (Zealy-Style) (`/zealy`)
- View active quests, daily check-in rewards, and real-time global leaderboard.
- **Proof Screenshot Compression**: Automatically compresses user uploaded screenshots down to 1000px max dimensions at 75% JPEG quality directly in the browser to prevent payload timeouts under high traffic.

---

## ⚡ High Concurrency & Event Day Capacity

The application is optimized for **600+ concurrent attendees**:
1. **Static Next.js App**: Frontend pages are static assets served via CDN edge nodes.
2. **Client-Side Image Canvas Compression**: Screenshot proof images are compressed in-browser before upload, keeping API payloads under ~150KB.
3. **Database Performance**: Supabase query indexing ensures rapid response times for reads and ticket lookups.

---

## ❓ Troubleshooting & FAQs

#### Q: I see `useEffect is not defined` or React module error during dev.
- **Fix**: Refresh your browser tab (`Ctrl + R` / `Cmd + R`) to update the HMR cache. `components/registration-form.tsx` uses explicit `React.useEffect`.

#### Q: How do I allow a custom domain in Next.js development mode?
- `next.config.mjs` contains `allowedDevOrigins: ['event.chiprojects.com']`. Update this array if running dev server under custom proxies.

---

*Made with ❤️ for BlockQuest Fiesta PH 2026*
