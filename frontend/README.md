# SkylineOS Frontend

The unified, responsive web application for **SkylineOS**, serving students, campus club organizers, treasurers, and super administrators from a single codebase.

---

## 🌟 Architecture & Portals

SkylineOS unifies three distinct role-based experiences (+ public visitor discovery) under one responsive Single-Page Application (SPA):

- **Public & Student Portal (`src/student/`):**
  - Event discovery, category filters, and dynamic member pricing.
  - Solo & team registrations with encrypted digital ticket QR passkeys.
  - Club memberships: dues payment proofs, automatic renewal status, and member perks.
  - Campus merchandise store with variant selectors, live inventory tracking, and order history.
  - Volunteer task board: claim tasks, track progress (`TODO` → `IN_PROGRESS` → `DONE`).
  - Bookmarked / saved events synced across devices.
  - Notification center with trigger-maintained unread counters.
- **Club Head & Treasurer Dashboard (`src/club/`):**
  - Event controls: draft, publish, deadlines (floating wall-clock UTC+5:30), and capacity guards.
  - Live in-browser camera QR scanner (`html5-qrcode`) for sub-second door check-in.
  - Attendee payment proof review and ticket approval queue.
  - Club members roster & dues verification.
  - Merchandise catalog management with size variant stock tracking and order fulfillment.
  - Volunteer task creation and progress tracking.
  - Club announcements broadcast system.
  - Cryptographic finance suite: real-time overview, money flow diagram, expense claims approval & reimbursement, chain verification, and semester reports export (JSON, CSV, HTML, Vector PDF).
- **Super Admin Console (`src/admin/`):**
  - Campus telemetry: total clubs, events, users, and transaction volume.
  - User directory with `pg_trgm` fuzzy search, filters, and ban/reactivate controls.
  - Club approval and management.
  - Cryptographic single-use club registration key generator with expiration controls.
  - System-wide immutable audit trail.
- **Shared Infrastructure (`src/shared/`):**
  - Unified session (`session.ts`), auth provider, and navigation guards (`RequireRole`, `PublicOnly`).
  - Design tokens (`tokens.css`) supporting system-wide light and dark modes.

---

## 🚀 Live Production Deployment (Vercel)

- **Production URL:** [https://skyline27.vercel.app/](https://skyline27.vercel.app/)
- **Build Settings:**
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - SPA Routing: Handled by `vercel.json` (`rewrites: [ { source: "/(.*)", destination: "/index.html" } ]`)

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create `.env` in the `frontend` root:
```ini
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173/`.

### 4. Build for Production
```bash
npm run build
```
Generates optimized code-split production bundles in `dist/`.