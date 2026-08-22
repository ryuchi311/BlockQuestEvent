# ⚡ BlockQuest Fiesta PH — Web Platform & Event Suite

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers_%26_OpenNext-orange?style=for-the-badge&logo=cloudflare)](https://cloudflare.com/)

A full-stack, real-time event operations platform and gamified questing portal built for **BlockQuest Fiesta PH** (Manila's premier Web3 developer summit). 

The suite powers end-to-end event operations—from attendee registration with legal compliance and instant QR pass generation, to high-speed entrance scanners, sponsor booth engagement stations, proof verification queues, and a mobile-first gamified questing experience.

---

## 🌟 Key Portals & Feature Matrix

| Portal | Route | Target Audience | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **🏠 Launchpad** | `/` | All Visitors | Glassmorphic interactive gateway leading to tickets or game portal. |
| **🎫 Ticket Desk** | `/register` | Attendees | RA 10173 privacy compliant registration, social handles, and instant QR entry pass (`BQF-XXXXXX`) generation. |
| **🎮 BlockQuest App** | `/zealy` | Attendees | Gamified mobile app with daily missions, trivia quizzes, passcodes, flash countdowns, quest chains, milestone badges, and live leaderboards. |
| **📷 Gate Scanner** | `/scan` | Gate Staff | Sub-second camera QR scanner (`html5-qrcode`) for pass validation and check-ins with manual search fallback. |
| **🏪 Booth Scanner** | `/booth-scan` | Sponsor Booths | Station scanner awarding XP (+150 XP) to attendees visiting booths with duplicate check-in protection. |
| **⚙️ Admin Dashboard** | `/admin` | Organizers & Staff | Complete operational control center with RBAC (6 roles), metrics, paginated attendees, quest builder, verifier queue, booth scanner logs, and staff provisioning. |
| **🧭 Shortcut Hub** | `/shortcuts` | Staff & Sponsors | Quick launcher bookmark hub for on-site live operations. |
| **🧪 Stress Test** | `/stress-test` | Engineers / QA | Automated load and stress testing simulator for API performance benchmarking. |
| **📖 Visual Manual** | `/manual-presentation.html` | Organizers & Partners | Interactive HTML presentation manual, architecture diagrams, and operational playbooks. |

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
```

> ⚠️ **SECURITY WARNING**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code or public repositories. It is strictly used in server-side API routes.

---

## 🗄️ Database Initialization & Seed Data

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard) and open the **SQL Editor**.
2. Run the master schema in [`schema.sql`](file:///schema.sql):
   - Sets up `registrations`, `fiesta_event_quests`, `user_quest_progress`, `staff_roles`, `booth_scan_logs`, and audit tables.
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

Cloudflare Workers need the Supabase configuration at runtime. You have two options:

#### Option A: Using Wrangler CLI (Recommended for Secrets)
```bash
# Set server-side secret key (securely encrypted on Cloudflare)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Set public / server variables
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_STORAGE_BUCKET
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

#### Option B: Via Cloudflare Dashboard
1. Go to **Cloudflare Dashboard** > **Workers & Pages**.
2. Select your `blockquest-event` Worker.
3. Go to **Settings** > **Variables and Secrets**.
4. Add the environment variables and encrypt `SUPABASE_SERVICE_ROLE_KEY`.

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
| **👑 Superadmin** | Full System (`/admin/*`, `/scan`, `/booth-scan`, `/zealy`) | System configuration, staff provisioning, quest editing, attendee management, CSV export. |
| **💼 Event Manager** | `/admin`, `/scan`, `/booth-scan` | Attendee check-ins, quest creation/editing, metric review. |
| **📷 Gate Scanner** | `/scan` | Pass scanning and attendee gate check-in only. |
| **🏪 Booth Staff** | `/booth-scan` | Station scanning to log attendee booth visits and award XP. |
| **🔍 Quest Verifier** | `/admin` (Verifications Tab) | Reviews screenshot proof uploads and approves/rejects XP claims. |
| **👁️ Viewer** | `/admin` (Metrics & Attendees) | Read-only analytics and attendee directory. |

---

## 📁 Repository Structure

```
BlockQuestEvent/
├── app/                        # Next.js App Router (Pages, Layouts & Server API Routes)
│   ├── admin/                  # Organizer Control Center (6 RBAC modules)
│   ├── api/                    # Server-side API endpoints (Auth, Quests, Scan, Admin)
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
│   └── zealy-mobile-app.tsx    # Mobile Quest App, Quizzes, Badges & Leaderboard
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