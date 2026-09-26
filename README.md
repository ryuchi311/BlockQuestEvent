# ⚡ BlockQuest Fiesta PH — Web Platform & Event Suite

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers_%26_OpenNext-orange?style=for-the-badge&logo=cloudflare)](https://cloudflare.com/)

A full-stack, real-time event operations platform and gamified questing portal built for **BlockQuest Fiesta PH** (Manila's premier Web3 developer summit). 

The suite powers end-to-end event operations—from attendee registration with legal compliance and instant QR pass generation, to high-speed entrance scanners, sponsor booth engagement stations, proof verification queues, attendee helpdesk & support ticketing, and a mobile-first gamified questing experience.

---

## 🌟 Key Portals & Feature Matrix

| Portal | Route | Target Audience | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **🏠 Launchpad** | `/` | All Visitors | Glassmorphic interactive gateway leading to tickets or game portal. |
| **🎫 Ticket Desk** | `/register` | Attendees | RA 10173 privacy compliant registration, social handles, and instant QR entry pass (`BQF-XXXXXX`) generation with wallet pass styling. |
| **🎮 BlockQuest App** | `/zealy` | Attendees | Gamified mobile app with daily missions, trivia quizzes, passcodes, flash countdowns, quest chains, milestone badges, live leaderboards, and user feedback/support ticket center. |
| **📷 Gate Scanner** | `/scan` | Gate Staff | Sub-second camera QR scanner (`html5-qrcode`) for pass validation and check-ins with manual search fallback and audio cues. |
| **🏪 Booth Scanner** | `/booth-scan` | Sponsor Booths | Station scanner awarding XP (+150 XP) to attendees visiting booths with duplicate check-in protection. |
| **⚙️ Admin Dashboard** | `/admin` | Organizers & Staff | Complete operational control center with RBAC (6 roles), 12 specialized operations tabs, drag-and-drop quest builder, proof verifier, support ticket helpdesk, audit logs, and staff provisioning. |
| **🧭 Shortcut Hub** | `/shortcuts` | Staff & Sponsors | Quick launcher bookmark hub for on-site live operations and station bookmarks. |
| **🧪 Stress Test** | `/stress-test` | Engineers / QA | Automated load and stress testing simulator for API performance benchmarking. |
| **📖 Visual Manual** | `/manual-presentation.html` | Organizers & Partners | Interactive HTML presentation manual, architecture diagrams, and operational playbooks. |

---

## 🛡️ Admin Dashboard Modules & Tabs (`/admin`)

The Admin Dashboard provides 12 specialized operation tabs tailored to different staff roles:

1. **📷 QR Gate Scanner (`scanner`)**: Live camera scanner directly embedded within the admin suite for entrance check-ins.
2. **🎫 Attendees Directory (`attendees`)**: Paginated attendee records (10/20/50/100 per page), instant search, check-in status toggles, Excel/CSV export, and pass resends.
3. **⚡ Event Quests Engine (`quests`)**: 
   - Drag-and-drop reordering with persistent database sort order.
   - Comprehensive quest builder: Instant, Screenshot Proof, Quester Message Note, Quiz Trivia (with auto-grading), Secret Passcode, Discord Server Join, and Telegram Chat Join.
   - **Quick Presets** with automatic collision-safe slug generation (`generateUniqueSlug`) preventing duplicate quest IDs.
   - Real-time `⚠️ Already Taken` / `✓ Available` badges with **✨ Auto-Fix ID** and **🎲 Random ID** buttons.
4. **🏆 Milestone Badges & Tiers (`milestones`)**: Dynamic tier configuration (e.g. Bronze, Silver, Gold, Platinum, VIP Legend) with customizable XP requirements, icons, and badge colors.
5. **🔍 Quest Proof Verifications (`verifications`)**: Screenshot proof review queue with high-res zoom, pan inspection, instant approve/reject actions, and XP award triggers.
6. **💬 Quester Message Notes (`messages`)**: Dedicated queue for reviewing attendee text responses, code submission links, and text-only quest requirements.
7. **🆘 Help & Support Tickets (`tickets`)**: Live helpdesk ticket desk. Filters by status (Open, In Progress, Resolved, Closed), type (feedback, issue, bug, question, complaint), priority, and keyword search. Full modal for staff notes, resolution, and responder tracking.
8. **📊 Global Audit Quest Log (`questlog`)**: Real-time event log tracking all quest completions, booth check-ins, manual awards, and staff interactions.
9. **🏪 Sponsor Booth Stations (`booths`)**: Manage sponsor booth codes, custom XP values, scan quotas, and export booth engagement metrics.
10. **🛡️ Staff & Admin Credentials (`staff`)**: Role-based access control management, temporary password provisioning, forced password resets, and audit trails.
11. **📣 Social Missions (`socials`)**: Rapidly configure X (Twitter), Facebook, and Discord follow/retweet campaigns with custom CTA button colors.
12. **🎁 Promo Codes (`promocodes`)**: Create referral and flash bonus codes with claim limits and expiration dates.

---

## 📋 System Requirements & Prerequisites

### 1. Development Environment
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm` `v10.x` or higher
- **Operating System**: Windows, macOS, or Linux (WSL recommended for Windows Cloudflare builds)

### 2. Cloud Infrastructure & Accounts
- **Supabase Account**:
  - PostgreSQL Database with Row Level Security (RLS)
  - Supabase Storage Bucket: `blockquestbucket` (Public read / authenticated write)
- **Cloudflare Account**:
  - Cloudflare Workers & Pages enabled
  - Cloudflare Wrangler CLI authenticated (`npx wrangler login`)
  - (Optional) Custom domain connected to Cloudflare DNS (e.g. `event.block-quest.com`)
- **(Optional) Third-Party Integrations**:
  - **Discord Bot**: Guild ID, Bot Token, or Webhook URL for automated community join verification.
  - **Telegram Bot**: Bot Token for verifying chat/channel memberships.

---

## 🔐 Environment Variables Configuration

Create a `.env.local` file in the project root based on `.env.example`:

```env
# ==============================================================================
# Supabase Backend Configuration
# ==============================================================================
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
SUPABASE_STORAGE_BUCKET=blockquestbucket

# ==============================================================================
# Supabase Client / Public Configuration (Exposed to browser)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key

# ==============================================================================
# Discord OAuth & Server Verification (Optional)
# ==============================================================================
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_GUILD_ID=your-discord-guild-id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_CHANNEL_ID=your-channel-id

# ==============================================================================
# Telegram Bot API Verification (Optional)
# ==============================================================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# ==============================================================================
# Application URL
# ==============================================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **SECURITY WARNING**: Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_CLIENT_SECRET`, or `TELEGRAM_BOT_TOKEN` in client-side code or public repositories. They are strictly read in server-side API routes.

---

## 🗄️ Database Initialization & Seed Data

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard) and open the **SQL Editor**.
2. Run the master schema in [`schema.sql`](file:///schema.sql):
   - Sets up `registrations`, `fiesta_event_quests`, `user_quest_progress`, `quest_completions`, `support_tickets`, `staff_roles`, `booth_scan_logs`, and audit tables.
   - Creates automatic ticket generation triggers (`BQF-XXXXXX`).
3. (Optional) Run seed scripts:
   - **Admin Account**: `npm run seed:admin`
   - **Sponsor Booths**: Run [`seed_booths.sql`](file:///seed_booths.sql) in SQL Editor
   - **Social Missions**: `npm run seed:socials`
   - **Staff Roles**: Run [`seed_test_roles.sql`](file:///seed_test_roles.sql) in SQL Editor
4. **Storage Bucket**: In Supabase Dashboard > Storage, create a public bucket named `blockquestbucket` with read permissions for quest verification uploads.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run the Next.js development server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

On Windows, you can also double-click [`start-project.bat`](file:///start-project.bat) to launch the dev server and open the browser automatically.

---

## ☁️ Deploying to Cloudflare (OpenNext)

This application is built with **Next.js 16 App Router** and deploys natively to **Cloudflare Workers** using [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

### Step 1: Authenticate Wrangler CLI
Log in to your Cloudflare account via the terminal:
```bash
npx wrangler login
```
Verify authentication:
```bash
npx wrangler whoami
```

---

### Step 2: Configure Cloudflare Secrets & Environment Variables

Cloudflare Workers need the Supabase and API configuration at runtime. You have two options:

#### Option A: Using Wrangler CLI (Recommended for Secrets)
```bash
# Set server-side secret key (securely encrypted on Cloudflare)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Set public / server variables
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_STORAGE_BUCKET
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# Optional integrations
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put DISCORD_GUILD_ID
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

#### Option B: Via Cloudflare Dashboard
1. Go to **Cloudflare Dashboard** > **Workers & Pages**.
2. Select your `blockquest-event` Worker.
3. Go to **Settings** > **Variables and Secrets**.
4. Add the environment variables and encrypt secrets.

---

### Step 3: Review `wrangler.jsonc`

Check [`wrangler.jsonc`](file:///wrangler.jsonc):

```jsonc
{
  "name": "blockquest-event",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-08-21",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  // If you have a custom domain on Cloudflare DNS:
  "routes": [
    {
      "pattern": "event.block-quest.com",
      "custom_domain": true
    }
  ]
}
```

> 💡 **Deploying without a Custom Domain?**
> If you do not have a custom domain configured yet, you can remove or comment out the `"routes"` block and add `"workers_dev": true` to deploy to `<worker-name>.<your-subdomain>.workers.dev`.

---

### Step 4: Build & Preview Locally

Test the Cloudflare bundle locally using the OpenNext workerd runtime emulator:

```bash
# Build the OpenNext Cloudflare bundle
npm run build:cf

# Preview on local Cloudflare workerd runtime
npm run preview:cf
```

---

### Step 5: Deploy to Cloudflare

Deploy the application and assets with a single command:

```bash
npm run deploy
```

Upon completion, Wrangler will output your live production URL (e.g., `https://event.block-quest.com` or `https://blockquest-event.<your-subdomain>.workers.dev`).

---

### Step 6: Supabase CORS & Auth Configuration

In your **Supabase Dashboard** > **Authentication** > **URL Configuration**:
1. Add your production domain (`https://event.block-quest.com`) to **Site URL** and **Redirect URLs**.
2. Ensure your Supabase Storage CORS allows requests from your Cloudflare domain.

---

## 📜 Available NPM Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Starts local Next.js development server with Fast Refresh. |
| `npm run build` | `next build` | Compiles standard Next.js production build. |
| `npm run build:cf` | `opennextjs-cloudflare build` | Builds OpenNext Cloudflare worker bundle and assets. |
| `npm run preview:cf`| `opennextjs-cloudflare preview` | Previews Cloudflare worker locally using Wrangler. |
| `npm run deploy` | `opennextjs-cloudflare deploy` | Builds and deploys directly to Cloudflare Workers. |
| `npm run start` | `next start` | Runs production Node.js server. |
| `npm run stress-test`| `node stress-test.mjs` | Runs simulated load test against registrations and quest APIs. |
| `npm run seed:admin` | `node seed_admin.mjs` | Seeds initial Superadmin credentials into Supabase. |
| `npm run seed:socials`| `node seed-socials.mjs`| Seeds default social media follower missions. |

---

## 🛡️ Role-Based Access Control (RBAC) Matrix

| Role | Route Access | Capabilities |
| :--- | :--- | :--- |
| **👑 Superadmin** | Full System (`/admin/*`, `/scan`, `/booth-scan`, `/zealy`) | System configuration, staff provisioning, quest editing, attendee management, CSV export, support tickets, and audit trails. |
| **💼 Event Manager** | `/admin`, `/scan`, `/booth-scan` | Attendee check-ins, quest creation/editing, milestone tier management, metric review, and support ticket triage. |
| **📷 Gate Scanner** | `/scan` | Pass scanning and attendee gate check-in only. |
| **🏪 Booth Staff** | `/booth-scan` | Station scanning to log attendee booth visits and award XP. |
| **🔍 Quest Verifier** | `/admin` (Verifications, Messages, Tickets, Quest Log) | Reviews screenshot proof uploads, quester message notes, attendee support tickets, and approves/rejects XP claims. |
| **🎫 Gate Management** | `/admin` (Scanner, Attendees, Tickets, Quest Log) | Dedicated attendee check-in management and ticket assistance. |
| **👁️ Viewer** | `/admin` (Read-only on stats, attendees, quests, tickets) | Read-only analytics, metric reviews, and attendee directory. |

---

## 📁 Repository Structure

```
BlockQuestEvent/
├── app/                        # Next.js App Router (Pages, Layouts & Server API Routes)
│   ├── admin/                  # Organizer Control Center (12 operational tabs)
│   ├── api/                    # Server-side API endpoints
│   │   ├── admin/              # Admin-authenticated endpoints (quests, tickets, users, checkin, etc.)
│   │   ├── auth/               # Third-party auth callbacks (Discord OAuth, Telegram verification)
│   │   ├── support/            # User-facing support & feedback ticket submission
│   │   ├── user/               # Attendee quest claim, passcode sync, and profile endpoints
│   │   ├── booth-scan/         # Sponsor booth QR scanning endpoint
│   │   ├── leaderboard/        # Real-time XP leaderboard ranking
│   │   └── register/           # Attendee dual-consent registration & ticket generator
│   ├── booth-scan/             # Sponsor Booth Station QR Scanner
│   ├── register/               # Attendee Registration & Ticket Pass Page
│   ├── scan/                   # Live Camera QR Gate Check-in Scanner
│   ├── shortcuts/              # Operations Shortcut Hub
│   ├── stress-test/            # QA Load Simulation UI
│   ├── zealy/                  # BlockQuest Mobile Gamified App
│   ├── layout.tsx              # Root Layout & Global Metadata
│   └── page.tsx                # Launchpad Selection Screen
├── components/                 # Core UI Components
│   ├── registration-form.tsx   # Dual-Consent Registration Form & QR Pass UI
│   ├── qr-scanner.tsx          # HTML5 Camera QR Scanner Engine
│   └── zealy-mobile-app.tsx    # Mobile Quest App, Quizzes, Badges, Feedback Modal & Leaderboard
├── public/                     # Static media, partner logos, presentation manual
├── open-next.config.ts         # OpenNext Cloudflare Adapter Configuration
├── wrangler.jsonc              # Cloudflare Workers & Custom Domain Config
├── schema.sql                  # PostgreSQL Tables, Triggers, & RLS Policies
├── seed_admin.mjs              # Initial Superadmin Seeder
├── seed-socials.mjs            # Social Quests Seeder
├── seed_booths.sql             # Sponsor Booth Station Seeder
├── seed_test_roles.sql         # Test Staff Roles Seeder
├── stress-test.mjs             # Node.js API Load Tester
├── start-project.bat           # 1-Click Windows Dev Launcher
└── README.md                   # Platform Documentation
```

---

## 📄 License & Attribution

© 2026 BlockQuest. All rights reserved. Built with ❤️ for the Web3 Developer Community.