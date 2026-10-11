# SkylineOS Deployment & Infrastructure Guide

This document describes how **SkylineOS** is deployed and configured in production, linking the Vercel frontend, Render backend, and PostgreSQL database.

---

## 🌐 Production Architecture Overview

```
 [Users / Browsers]
         │
         ▼
  ┌──────────────────────────────────────────────┐
  │         Frontend: Vercel SPA                 │
  │      https://skyline27.vercel.app/           │
  │  • Built with Vite + React 18 + TS           │
  │  • Code-split chunks for Student, Club, Admin│
  │  • SPA Routing via vercel.json               │
  └──────────────────────┬───────────────────────┘
                         │ HTTPS / REST API
                         ▼
  ┌──────────────────────────────────────────────┐
  │         Backend: Render Web Service          │
  │      https://skyline27.onrender.com/         │
  │  • Express 5 + Node.js (Singapore region)    │
  │  • Authoritative RBAC & Rate Limiting        │
  │  • PDFKit financial report generation        │
  │  • Health check at /api/health               │
  └──────────────────────┬───────────────────────┘
                         │ Pooled / Direct Connection
                         ▼
  ┌──────────────────────────────────────────────┐
  │       Database: PostgreSQL (Supabase / Cloud)│
  │  • Prisma ORM with pg_trgm extension         │
  │  • Append-only ledger immutability trigger   │
  │  • Trigger-maintained cached counters        │
  └──────────────────────────────────────────────┘
```

---

## 1. Frontend Deployment (Vercel)

- **Production URL:** `https://skyline27.vercel.app/`
- **Framework Preset:** Vite
- **Root Directory:** `frontend/`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** `20.x`

### SPA Routing Configuration (`vercel.json`)
Since SkylineOS is a Single-Page Application (SPA) using React Router, all path requests must be rewritten to `index.html`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Frontend Environment Variables
Set the following environment variables in the Vercel Project Settings:

| Variable | Example Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://skyline27.onrender.com/api` | Base URL pointing to the production Render backend |
| `VITE_GOOGLE_CLIENT_ID` | `916010885027-...apps.googleusercontent.com` | Google OAuth client ID for student & club head sign-in |

---

## 2. Backend Deployment (Render)

- **Production URL:** `https://skyline27.onrender.com`
- **Health Check Endpoint:** `https://skyline27.onrender.com/api/health`
- **Service Type:** Web Service
- **Runtime:** Node
- **Region:** Singapore (`singapore`)
- **Root Directory:** `backend/`
- **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
- **Start Command:** `npm start`

### Infrastructure Blueprint (`backend/render.yaml`)

```yaml
services:
  - type: web
    name: spotlight-backend
    env: node
    region: singapore
    buildCommand: npm install && npm run build && npx prisma migrate deploy
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: CORS_ORIGINS
        sync: false
      - key: SMTP_HOST
        sync: false
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
      - key: CAMPUS_UTC_OFFSET_MINUTES
        value: "330"
      - key: SITE_URL
        sync: false
      - key: CRON_SECRET
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: UPLOAD_SECRET
        sync: false
```

### Backend Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Defaults to `5000` (Render overrides with its own `$PORT`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (direct or pooled with SSL) |
| `JWT_SECRET` | Yes | High-entropy secret key for signing user session JWTs |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins (e.g., `https://skyline27.vercel.app`) |
| `SITE_URL` | Yes | Base URL of the frontend app (e.g., `https://skyline27.vercel.app`) |
| `CAMPUS_UTC_OFFSET_MINUTES`| Yes | Campus wall-clock timezone offset (e.g., `330` for IST UTC+5:30) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth verification client ID |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Optional | Mailer credentials for password recovery emails |
| `UPLOAD_SECRET` | Optional | Secret key for signed image uploads |

---

## 3. Database Deployment (PostgreSQL via Prisma)

SkylineOS runs on standard PostgreSQL (version 15+) and requires the `pg_trgm` extension for trigram search.

### Migration Deployment Sequence
In automated CI/CD and deployment pipelines:

```bash
# 1. Apply additive schema migrations
npx prisma migrate deploy

# 2. Apply PostgreSQL append-only triggers, check constraints, and reporting views
npm run db:constraints

# 3. Seed deterministic base data (if provisioning a fresh database)
npm run db:seed
```

### Database Guarantees in Production:
- **`pg_trgm` Extension:** Created automatically by migrations for sub-10ms fuzzy text search on large user/event tables.
- **Append-Only Ledger Trigger:** `trg_ledger_immutable` strictly denies `UPDATE` and `DELETE` on `LedgerEntry`.
- **Trigger-Maintained Counters:** Registration counts (`Event.pendingCount`, `confirmedCount`), merch stock (`Product.totalStock`), and unread notifications are updated transactionally.
- **Counter Verification:** Run `npm run db:verify-counters` after any manual database restore to verify and repair any counter drift.

---

## 4. Verification & Health Monitoring

### Service Health Check
Verify backend availability:
```bash
curl -X GET https://skyline27.onrender.com/api/health
```
**Expected Response (HTTP 200):**
```json
{
  "status": "success",
  "message": "SkylineOS API Server is live!"
}
```

### Cryptographic Ledger Verification
Verify the financial blockchain state in production:
```bash
curl -X GET https://skyline27.onrender.com/api/finance/audit/verify \
  -H "Authorization: Bearer <CLUB_HEAD_OR_SUPER_ADMIN_TOKEN>"
```
**Expected Response (HTTP 200):**
```json
{
  "valid": true,
  "headHash": "...",
  "chainLength": 42,
  "brokenLinks": 0,
  "verifiedAt": "2026-10-11T..."
}
```

---

## 5. Troubleshooting & Common Issues

### 1. CORS Origin Errors
- **Symptom:** Browser console reports blocked cross-origin requests.
- **Fix:** Ensure `CORS_ORIGINS` in Render environment settings contains `https://skyline27.vercel.app` (without trailing slash).

### 2. Cold Starts on Render
- Render free instances spin down after inactivity. The first request after idle can take ~30-50 seconds. The frontend displays graceful loading states and spinners while waiting for the backend to wake up.

### 3. Database Statement Timeouts on Bulk Tests
- For massive 50,000-row synthetic benchmark tests (`tests/schema.test.ts`), pooled connection proxies (such as Supabase pooler on port 6543) may enforce a default statement timeout. Connect via direct database URL (`SUPABASE_DIRECT_URL`) or execute against local PostgreSQL for offline benchmarks.
