# SkylineOS Backend

The authoritative Node.js/Express 5 backend for **SkylineOS**, powered by TypeScript, Prisma ORM, and PostgreSQL.

---

## 🏛️ Architecture Highlights

- **Authoritative RBAC:** Exactly three application roles (`STUDENT`, `CLUB_HEAD`, `SUPER_ADMIN`). Roles are read and enforced exclusively on the database side via `middlewares/authorize.ts`.
- **Append-Only Cryptographic Ledger:** SHA-256 block-chained transaction entries linking to `prevHash`. PostgreSQL trigger `trg_ledger_immutable` strictly denies `UPDATE` and `DELETE` on `LedgerEntry`.
- **Financial Anti-Fraud Guard:** Self-approval of expense claims is strictly rejected (HTTP 403 Forbidden). Separation of liability (*Owed to Volunteers*) and reimbursement (atomic `OUT` / `EXPENSE` entry).
- **Trigger-Maintained Stored Counters:** High-traffic list queries read cached counter columns (`pendingCount`, `confirmedCount`, `totalStock`, `unreadNotificationCount`) updated automatically by Postgres triggers.
- **Sub-10ms Fuzzy Search:** PostgreSQL `pg_trgm` GIN indexes for fast partial-string matching.
- **Reporting Engine:** Semester financial reports exported in JSON, CSV, print HTML, and vector PDF (PDFKit).
- **Timezone Awareness:** Floating wall-clock deadline evaluation configured via `CAMPUS_UTC_OFFSET_MINUTES` (defaults to `330` for IST UTC+5:30).

---

## 🛠️ Scripts & Commands

| Script | Command | Description |
|---|---|---|
| Development Server | `npm run dev` | Starts server in watch mode using `tsx` |
| Build | `npm run build` | Generates Prisma client and compiles TypeScript to `dist/` |
| Start Production | `npm start` | Runs compiled `dist/index.js` |
| Deploy Migrations | `npm run db:deploy` | Applies pending Prisma migrations (`prisma migrate deploy`) |
| Apply Constraints | `npm run db:constraints` | Applies triggers, check constraints, and reporting views |
| Seed Database | `npm run db:seed` | Populates deterministic demo data (clubs, users, gala tickets, ledger) |
| Reset Demo | `npm run db:reset-demo` | Applies constraints and seeds data in one command |
| Verify Counters | `npm run db:verify-counters`| Scans for stored counter drift and repairs columns |
| Create Super Admin | `npm run admin:create` | Interactively creates the initial Super Admin account |
| Full Test Suite | `npm test` | Runs all 11 test suites across RBAC, ledger, auth, and schema |
| Finance Test Suite | `npm run test:finance` | Runs cryptographic ledger, claims, and audit tests |
| RBAC Security Suite | `npm run test:rbac` | Tests route authorization guards across all roles |
| Schema & Indexes | `npm run test:schema` | Validates constraints and explains index plans |

---

## 📁 Project Structure

```
backend/
├── config/             # Environment parsing (env.ts) and Prisma DB connection (db.ts)
├── middlewares/        # Authentication, RBAC authorize guards, rate limiting, error handlers
├── modules/            # Feature modules (routes + services)
│   ├── admin/          # Platform overview, user management, registration keys, audit logs
│   ├── announcements/  # Club announcement feed and broadcaster
│   ├── auth/           # Login, registration, Google OAuth, password reset
│   ├── clubs/          # Club directory, profiles, stats
│   ├── events/         # Event lifecycle, capacity, deadlines, QR ticket scanner
│   ├── finance/        # Cryptographic ledger, audit verify, PDF/CSV/HTML semester reports
│   ├── memberships/    # Club membership plans, dues verification, member status
│   ├── merchandise/    # Merchandise catalog, variants, atomic stock decrements, orders
│   ├── notifications/  # User notification feed and read tracking
│   ├── profiles/       # User profile details and saved events
│   ├── registrations/  # Solo & team event tickets, payment proofs, approval queue
│   └── tasks/          # Volunteer task Kanban boards
├── prisma/             # schema.prisma and additive migrations
├── scripts/            # Database constraint scripts, seeders, counter verifiers
├── tests/              # Automated test suites
├── app.ts              # Express application setup, security middlewares, route mounting
└── index.ts            # Server entrypoint
```

---

## 🌐 Production Deployment (Render)

SkylineOS backend is deployed as a managed Web Service on Render:
- **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
- **Start Command:** `npm start`
- **Health Check Endpoint:** `/api/health`

Refer to [docs/DEPLOYMENT.md](file:///c:/Coding/Skyline27/docs/DEPLOYMENT.md) and [docs/API.md](file:///c:/Coding/Skyline27/docs/API.md) for full details.
