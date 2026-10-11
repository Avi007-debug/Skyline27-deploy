# 🌌 SkylineOS — Club & Campus Event Operating System

[![Production Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=for-the-badge&logo=vercel)](https://skyline27.vercel.app/)
[![Production Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://skyline27.onrender.com)
[![API Health](https://img.shields.io/badge/API_Status-Online-brightgreen?style=for-the-badge)](https://skyline27.onrender.com/api/health)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.2-white?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

**SkylineOS** is a unified, high-performance operating system designed for university clubs, event organizers, students, and treasurers. It consolidates event discovery, solo/team ticketing, membership dues with dynamic member pricing, official club merchandise with live inventory, volunteer task boards, QR passkey door check-in, and a **cryptographically tamper-evident, append-only financial ledger**.

---

## 🚀 Live Deployments

The complete platform is live and running in production:

| Service | Environment | Live URL | Description |
|---|---|---|---|
| **Web Application** | Vercel | [**skyline27.vercel.app**](https://skyline27.vercel.app/) | Production React SPA with code-split Student, Club, and Admin portals |
| **API Server** | Render | [**skyline27.onrender.com**](https://skyline27.onrender.com) | Express 5 + Prisma ORM + PostgreSQL cloud backend |
| **API Health Check** | Render | [**skyline27.onrender.com/api/health**](https://skyline27.onrender.com/api/health) | Live service status (`status: "success"`) |

### Direct Portal Entrypoints

- 🌐 **Visitor Landing & Event Catalogue:** [skyline27.vercel.app](https://skyline27.vercel.app/)
- 🎓 **Student Sign-in & Dashboard:** [skyline27.vercel.app/login](https://skyline27.vercel.app/login)
- 🏛️ **Club Head & Treasurer Portal:** [skyline27.vercel.app/club/auth](https://skyline27.vercel.app/club/auth)
- 🛡️ **Super Admin Console:** [skyline27.vercel.app/admin/login](https://skyline27.vercel.app/admin/login)

---

## 🔑 Demo Credentials for Live Evaluation

The production database is seeded with deterministic test accounts for each role (all accounts share the password `Password@123`):

| Role | Portal URL | Email | Password | What to Test |
|---|---|---|---|---|
| **Super Admin** | [`/admin/login`](https://skyline27.vercel.app/admin/login) | `admin@skyline.local` | `Password@123` | Platform analytics, user moderation, club registration keys, global audit logs |
| **Club Head (GDG)** | [`/club/auth`](https://skyline27.vercel.app/club/auth) | `aarav.gdg@college.edu` | `Password@123` | Event creation, ticket approval queue, live camera QR check-in scanner, merchandise stock, tasks board |
| **Club Treasurer** | [`/club/auth`](https://skyline27.vercel.app/club/auth) | `ananya.treasurer@college.edu` | `Password@123` | Financial dashboard, money flow diagram, volunteer claim reimbursement, cryptographic audit verification, PDF/CSV semester reports |
| **Student / Volunteer** | [`/login`](https://skyline27.vercel.app/login) | `karthik.volunteer@college.edu` | `Password@123` | Claiming volunteer tasks, submitting receipt-backed expense claims with OCR check |
| **General Student** | [`/login`](https://skyline27.vercel.app/login) | `priya.nair@college.edu` | `Password@123` | Event ticketing with QR passkeys, joining clubs, member discount pricing on tickets and merch |

---

## 🌟 Key Features & What's New

### 1. 🎟️ Smart Ticketing & Dynamic Member Pricing
- **Solo & Team Registrations:** Support for individual tickets and team registrations with unique team passkeys and captain management.
- **Dynamic Member Pricing:** Active club members automatically receive exclusive discounted fees (`memberFee` on events, `memberDiscountPercent` on merchandise).
- **Digital Ticket Passkeys:** Instant ticket generation with encrypted QR codes for seamless admission verification.
- **Deadlines & Capacity Guards:** Server-side floating wall-clock deadline enforcement (UTC+5:30 campus timezone) and row-level locking to prevent overselling.

### 2. 💳 Club Memberships & Dues
- **Integrated Dues Management:** Join clubs with transparent semester/annual dues or free instant tier.
- **Validity & Renewal Tracking:** Active membership status computed dynamically (`status = ACTIVE` and `endDate > now()`) without brittle background cron jobs.
- **Member Roster:** Club heads can inspect active members, review dues payment proofs, and track membership tenure.

### 3. 🛍️ Official Campus Merchandise Store
- **Product Variants & Inventory:** Size (S, M, L, XL) and style variants with live stock tracking.
- **Overselling Prevention:** Conditional transactional atomic stock decrements (`UPDATE ... WHERE stock >= qty`).
- **Member Discounts:** Automatic percentage discounts applied at checkout for active club members.
- **Order Fulfillment Pipeline:** Status transitions from `PENDING_PAYMENT` → `PAYMENT_SUBMITTED` → `PAID` with receipt attachment.

### 4. 📋 Volunteer Tasks Kanban Board
- **Event-Linked Tasks:** Organizers break down events into actionable tasks (`TODO`, `IN_PROGRESS`, `DONE`).
- **Student Volunteering:** Students and volunteers can browse, claim, and update tasks directly from their dashboard.
- **Trigger-Maintained Task Counters:** `Event.taskCount` and `Event.taskDoneCount` are maintained automatically by database triggers.

### 5. 📢 Club Announcements Feed
- **Broadcast System:** Club heads broadcast real-time announcements (`MEETING`, `DEADLINE`, `GENERAL`).
- **Automatic Notification Triggers:** Publishing an announcement immediately creates unread in-app notifications for all active club members.

### 6. 📷 Live Camera QR Scanner for Door Check-in
- **In-Browser Scanner:** Integrated `html5-qrcode` scanner inside the Club Head dashboard.
- **Sub-Second Door Admission:** Scans student ticket QR codes or team passkeys, marks attendance timestamp (`checkedInAt`), and flags duplicate or invalid tickets.

### 7. 🔒 Cryptographic Ledger & Anti-Fraud Financial Suite
- **SHA-256 Hash Chained Ledger:** Every financial transaction links cryptographically to the preceding entry (`prevHash` → `hash`), forming an immutable chain.
- **PostgreSQL Immutability Trigger:** `trg_ledger_immutable` strictly blocks all `UPDATE` and `DELETE` queries on `LedgerEntry`. Corrections are strictly made via reversing entries (`reversesId`).
- **Integer Paise Storage:** All money values stored strictly in integer paise (`₹100.00 = 10000 paise`) to prevent floating-point rounding errors.
- **Anti-Fraud Volunteer Expense Claims:**
  - Receipt upload with optical scanned amount comparison (`mismatchFlag`).
  - Backend guard strictly rejects self-approval of claims (HTTP 403 Forbidden).
  - Clear separation of liability (*Owed to Volunteers*) and reimbursement (atomic `OUT` / `EXPENSE` ledger write).
- **Multi-Format Semester Financial Reports:**
  - 📊 REST API JSON (`/api/finance/report`)
  - 📥 Formatted CSV Download (`/api/finance/report/csv`)
  - 🖨️ Print-Ready HTML Document (`/api/finance/report/html`)
  - 📄 Crisp Vector PDF Export (`/api/finance/report/pdf`) generated via PDFKit with formal header, category summaries, event P&L, and liability breakdown.
- **Live Cryptographic Verification:** Instant audit endpoint (`/api/finance/audit/verify`) that verifies the full chain hash from genesis to head hash in real time.

### 8. 🛡️ Super Admin Governance Console
- **Platform Telemetry:** Live counters of campus clubs, active events, registered users, and total transaction volume.
- **User Governance:** Full-text trigram fuzzy search across names, emails, and USNs with ban/reactivate controls.
- **Club Registration Keys:** Issue cryptographically secure, single-use, expiring authorization keys for onboarding new club heads.
- **Global Audit Logs:** Comprehensive immutable audit trail (`AuditLog`) recording all security, governance, and financial actions.

---

## 🏛️ System Architecture

SkylineOS is engineered as **one unified responsive web application** and **one authoritative Express backend**:

```
                                  ┌──────────────────────────────────────────────┐
                                  │                  SkylineOS                   │
                                  │           Unified Web Application            │
                                  │      (Vercel: https://skyline27.vercel.app)  │
                                  └───────┬──────────────┬──────────────┬────────┘
                                          │              │              │
                    ┌─────────────────────┴───┐   ┌──────┴──────┐   ┌───┴─────────────────────┐
                    │ Public & Student        │   │ Club Head   │   │ Super Admin             │
                    │ • Events Discovery      │   │ • Events    │   │ • Platform Telemetry    │
                    │ • Ticket QR Passkeys    │   │ • Scanner   │   │ • User Moderation       │
                    │ • Club Memberships      │   │ • Merch     │   │ • Club Approvals        │
                    │ • Merchandise Store     │   │ • Tasks     │   │ • Registration Keys     │
                    │ • Volunteer Tasks       │   │ • Ledger    │   │ • Global Audit Trail    │
                    └─────────────────────┬───┘   └──────┬──────┘   └───┬─────────────────────┘
                                          │              │              │
                                          └───────┬──────┴──────┬───────┘
                                                  │ (Bearer Token / RBAC)
                                                  ▼
                                  ┌──────────────────────────────────────────────┐
                                  │           SkylineOS Express API Server       │
                                  │   (Render: https://skyline27.onrender.com)   │
                                  │ • Express 5 + Helmet + CORS + Rate Limiting  │
                                  │ • Authoritative RBAC (STUDENT/CLUB_HEAD/ADM) │
                                  │ • Floating Wall-Clock Deadlines (UTC+5:30)   │
                                  │ • Nodemailer Email / Google OAuth 2.0        │
                                  │ • PDFKit Vector PDF Financial Report Engine  │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │           PostgreSQL Database                │
                                  │ • Append-Only Ledger (Trigger Protected)     │
                                  │ • Trigger-Maintained Counters (O(1) Reads)   │
                                  │ • pg_trgm Trigram Indexes (Sub-10ms Search)  │
                                  │ • Composite Indexes for Strict Query Plans   │
                                  └──────────────────────────────────────────────┘
```

### Role Separation & Routing Table

| Role | Landing Area | Sign-in URL | Allowed Scope |
|---|---|---|---|
| **Visitor** | `/` | None | Public event catalog, club directory, merchandise browsing, announcements |
| **`STUDENT`** | `/home` | `/login` | Event registration, QR tickets, club membership, merch store, volunteer tasks, profile |
| **`CLUB_HEAD`** | `/club` | `/club/auth` | Club dashboard: events, ticket review, QR scanner, members, merch inventory, finance |
| **`SUPER_ADMIN`** | `/admin` | `/admin/login` | Platform console: users, clubs, events, registration keys, system audit logs |

---

## ⚡ Database Performance & Integrity Engineering

SkylineOS adheres to strict database engineering principles:

1. **Read, Don't Count (Stored Counters):** Database triggers automatically maintain cached counts on parent records, eliminating expensive `COUNT(*)` and `GROUP BY` queries on high-traffic pages:
   - `Event.pendingCount`, `confirmedCount`, `rejectedCount`
   - `Event.taskCount`, `taskDoneCount`
   - `Team.memberCount`
   - `Club.eventCount`, `productCount`
   - `Product.totalStock` (sum of active variants)
   - `Profile.unreadNotificationCount`
   - `Registration.clubId` (copied automatically on insert for single-table club filtering)
2. **Sub-10ms Fuzzy Search with `pg_trgm`:** PostgreSQL GIN trigram indexes power case-insensitive, partial-match searches (`ILIKE '%query%'`) across events, clubs, user names/emails/USNs, and registration keys.
3. **Composite Index Alignment:** Composite indexes are defined in exact `WHERE → ORDER BY` column order, guaranteeing index-only scans on lists and queues.
4. **Counter Drift Verification:** Built-in verification script (`npm run db:verify-counters`) detects and repairs any counter drift.

---

## 🛠️ Local Development & Quickstart

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (Local or Supabase)

### 1. Backend Setup

```bash
cd backend
npm install

# Copy environment configuration
cp .env.example .env
```

Ensure `.env` contains your database connection details:
```ini
PORT=5000
DB_MODE="local" # or "supabase"
LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skyline_dev?schema=public"
JWT_SECRET="your_secure_jwt_secret"
CAMPUS_UTC_OFFSET_MINUTES="330" # UTC+5:30 (India Standard Time)
```

Run database migrations, constraints, and seed deterministic demo data:
```bash
# 1. Deploy Prisma migrations
npm run db:deploy

# 2. Apply PostgreSQL append-only trigger, check constraints, and views
npm run db:constraints

# 3. Populate deterministic demo seed data
npm run db:seed

# (Or run both constraints + seed in one command)
npm run db:reset-demo
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Copy environment template if needed
# Ensure VITE_API_URL points to your backend (default: http://localhost:5000/api)
```

### 3. Start Development Servers

```bash
# Terminal 1: Backend API (starts on http://localhost:5000)
cd backend
npm run dev

# Terminal 2: Frontend Web App (starts on http://localhost:5173)
cd frontend
npm run dev
```

---

## 🧪 Automated Testing Suites

SkylineOS features a comprehensive automated testing suite:

```bash
cd backend

# Run the complete test suite (11 test suites)
npm test

# Run the cryptographic financial ledger, claims, and audit suites (23 tests)
npm run test:finance

# Run the Role-Based Access Control (RBAC) security suite
npm run test:rbac

# Run the schema integrity, trigger counters, and 50,000-row trigram index test
npm run test:schema

# Verify and repair stored counter integrity
npm run db:verify-counters
```

### Finance Test Coverage Summary
- `ledger.test.ts`: Genesis hash initialization, SHA-256 chaining, integer paise precision, idempotency, append-only trigger enforcement, tampering detection, and head hash consensus.
- `expenses_finance.test.ts`: Volunteer claim lifecycle, anti-fraud self-approval guard (HTTP 403), approval liability creation, atomic reimbursement ledger posting, and audit log generation.
- `reports_audit.test.ts`: Trigger blocking `UPDATE`/`DELETE`, PostgreSQL reporting views (`v_ledger_by_category`, `v_event_pnl`, `v_owed_to_volunteers`), and multi-format report generators (JSON, CSV, HTML, PDF).

---

## 📊 5-Minute Evaluation Walkthrough

Follow this step-by-step walkthrough to test the full lifecycle on either the **[live deployment](https://skyline27.vercel.app/)** or your local instance:

1. **Browse Public Site (Visitor):** Open [`https://skyline27.vercel.app/`](https://skyline27.vercel.app/), explore campus clubs, upcoming events, and official club merchandise.
2. **Student Event Ticketing & Member Pricing:**
   - Sign in as Student (`priya.nair@college.edu` / `Password@123`).
   - Navigate to **Clubs**, join **GDG on Campus**. Notice the instant member price unlock.
   - Register for **Cloud & GenAI DevFest 2026** at the discounted member rate.
   - Open **Tickets** to view your generated digital ticket passkey and QR code.
3. **Merchandise Purchase:** Navigate to **Merch**, select a hoodie size (S/M/L/XL), observe the active stock indicator and member discount, and place an order.
4. **Volunteer Tasks & Expense Claim:**
   - Sign in as Volunteer (`karthik.volunteer@college.edu` / `Password@123`).
   - Navigate to **Tasks**, claim an event volunteer task, and move it to `IN_PROGRESS`.
   - Submit a volunteer expense claim with receipt URL and entered amount.
5. **Club Head & QR Check-in Scanner:**
   - Sign in as Club Head (`aarav.gdg@college.edu` / `Password@123`).
   - Navigate to **Events → Check-in**, test the live camera/ticket QR scanner for instant door admission.
   - Navigate to **Registrations**, approve pending event tickets and merchandise orders.
6. **Treasurer Approval, Reimbursement & Ledger Verification:**
   - Sign in as Treasurer (`ananya.treasurer@college.edu` / `Password@123`).
   - Open **Finance → Claims**, review the volunteer claim, approve it (creates liability in *Owed to Volunteers*), and click **Reimburse** (writes an atomic `OUT` entry to the cryptographic ledger).
   - Navigate to **Finance → Audit**, run **Verify Chain** to inspect the 64-character SHA-256 head hash and confirm `0 broken links`.
   - Navigate to **Finance → Semester Reports**, review income by category, and download the report as **CSV**, **Printable HTML**, or **Vector PDF**.
7. **Super Admin Governance:**
   - Sign in as Super Admin (`admin@skyline.local` / `Password@123` at [`/admin/login`](https://skyline27.vercel.app/admin/login)).
   - Inspect campus-wide KPIs, search student profiles using trigram search, generate new club registration keys, and inspect global audit logs.

---

## 📦 Production Deployment Architecture

- **Frontend (Vercel):**
  - Hosted at [`https://skyline27.vercel.app/`](https://skyline27.vercel.app/)
  - Single-Page Application rewrites configured in `vercel.json` (`rewrites: [ { source: "/(.*)", destination: "/index.html" } ]`).
  - Code-split dynamic chunks for rapid initial load.
- **Backend (Render):**
  - Hosted at [`https://skyline27.onrender.com`](https://skyline27.onrender.com)
  - Managed via `render.yaml` with automatic build pipeline (`npm install && npm run build && npx prisma migrate deploy`).
  - CORS configured for authorized frontend origins.
  - Health check monitor mounted at `/api/health`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
