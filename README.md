# SkylineOS — Club & Campus Event Operating System

SkylineOS is a unified platform for college clubs, ticketing, memberships, merchandise, fundraisers, and tamper-evident financial management.

---

## 🏛️ System Architecture

SkylineOS connects members, volunteers, club organizers, and treasurers under a single identity model and a unified financial ledger.

```
                  ┌──────────────────────────────────────────────┐
                  │                 SkylineOS                    │
                  │   Unified Identity (Profile) & Role Guards   │
                  └───────┬──────────────┬──────────────┬────────┘
                          │              │              │
           ┌──────────────┴───┐   ┌──────┴──────┐   ┌───┴──────────────┐
           │ Person A         │   │ Person B    │   │ Person C         │
           │ Memberships,     │   │ Merchandise │   │ Dashboard,       │
           │ Tickets & Dues   │   │ & Shop      │   │ Fundraisers      │
           └──────────────┬───┘   └──────┬──────┘   └───┬──────────────┘
                          │              │              │
                          └───────┬──────┴──────┬───────┘
                                  │ (Confirmed Transactions)
                                  ▼
                  ┌──────────────────────────────────────────────┐
                  │ Person D: Cryptographic Ledger & Finance     │
                  │ • SHA-256 Block-chained Ledger               │
                  │ • Append-Only Immutability Trigger           │
                  │ • Volunteer Expense Claim Engine (Anti-Fraud)│
                  │ • SQL Reporting Views & Semester Reports     │
                  │ • Interactive Money-Flow Visualization       │
                  └──────────────────────────────────────────────┘
```

---

## 🔒 Financial Integrity & Ledger Architecture (Person D)

1. **Integer Paise Storage:** All money values are strictly stored in integer paise (`₹100.00 = 10000 paise`) to prevent floating-point rounding errors.
2. **SHA-256 Hash Chaining:** Every transaction row computes a cryptographic hash linking to the preceding entry's hash (`prevHash`).
3. **Append-Only Database Trigger:** PostgreSQL trigger `trg_ledger_immutable` forbids `UPDATE` and `DELETE` queries on `LedgerEntry`. Corrections must use reversing entries with `reversesId`.
4. **Anti-Fraud Guard:** Self-approval of expense claims is strictly rejected by the backend (HTTP 403).
5. **Separation of Approval and Reimbursement:**
   - **Approved claim:** Creates a financial liability recorded under *Owed to Volunteers*.
   - **Reimbursement:** Atomically transitions claim to `REIMBURSED` and writes an immutable `OUT` / `EXPENSE` transaction to the ledger.
6. **Reporting SQL Views & Role:**
   - `v_ledger_by_category`: Real-time category inflows and outflows.
   - `v_event_pnl`: Per-event revenue, expenses, and net profit/loss.
   - `v_owed_to_volunteers`: Active liabilities owed to volunteers.
   - `skyline_reporter`: Read-only role granted `SELECT` on reporting views.

---

## 🤝 Cross-Team Integration Contracts

### 👤 For Person A (Membership, Tickets & Payments)
When a membership dues payment or event ticket checkout is confirmed (via Razorpay webhook or admin approval), call `postLedger()`:
```typescript
import { postLedger } from './services/ledger';

await postLedger({
  type: 'IN',
  category: 'DUES', // or 'TICKET'
  amountPaise: amountInPaise,
  refType: 'MEMBERSHIP', // or 'TICKET'
  refId: paymentId,
  eventId: eventId,
  actorId: userId,
  memo: 'Membership dues payment',
});
```
*Rule: Never post pending or failed checkouts to the ledger.*

### 👤 For Person B (Merchandise Shop & Volunteer Claim Form)
- **Merchandise Orders:** When an order is paid, post to the ledger with category `MERCH` and `refId: orderId`.
- **Size Exchanges:** An exchange between sizes of the same price must not be posted as new revenue. Any price difference or refund must be recorded as an audit entry or reversing ledger entry.
- **Volunteer Claim Submission:** Frontend form submits to `POST /api/expenses` with `{ title, vendor, amountPaise, category, receiptUrl, scannedAmount, eventId }`.

### 👤 For Person C (Organizer Dashboard & Fundraisers)
- **Finance Tab:** In the organizer navigation, the `Finance` tab mounts `FinanceApp` (accessible by `TREASURER` and `ADMIN`).
- **Fundraisers:** Fundraiser donations post to the ledger with category `FUNDRAISER` and `projectId`. Net result = Fundraiser Inflows − Attributable Costs.

---

## 🛠️ Quickstart & Commands

### Prerequisites
- Node.js 20+
- PostgreSQL (Local or Supabase)

### 1. Backend Setup
```powershell
cd backend
npm install

# Copy environment template
cp .env.example .env
```

Ensure `.env` contains:
```ini
DB_MODE="local" # or "supabase"
LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skyline_dev?schema=public"
SUPABASE_DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?schema=public"
PORT=5000
JWT_SECRET="spotlight_dev_secret_change_in_production"
```

### 2. Database Migration, Constraints & Seed
```powershell
# 1. Apply PostgreSQL append-only trigger, check constraints, indexes, and reporting views:
npm run db:constraints

# 2. Populate deterministic seed data (clubs, users, gala tickets, merch, claims & ledger):
npm run db:seed

# 3. Or do both in one command:
npm run db:reset-demo
```

### 3. Run Automated Finance Test Suite
```powershell
npm run test:finance
```
Executes 23 automated tests across:
- `ledger.test.ts` (Genesis, hash chaining, concurrency, idempotency, tamper detection, head hash agreement)
- `expenses_finance.test.ts` (Claim lifecycle, anti-fraud 403 guard, reimbursement atomic ledger write)
- `reports_audit.test.ts` (Trigger blocks UPDATE/DELETE, views, JSON/CSV/HTML semester reports)

### 4. Start Development Servers
```powershell
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## 📊 5-Minute Demo Flow

1. **Member Ticket Purchase:** Member purchases a ticket at member discount price; ticket count updates and revenue flows to `TICKET` category.
2. **Merchandise Order:** Order placed for hoodie with size variant; sales revenue reflected in ledger.
3. **Fundraiser Activity:** Bake-sale fundraiser collects donations and tracks attributable expenses.
4. **Volunteer Expense Claim:** Volunteer submits a receipt-backed claim with OCR scanned amount comparison.
5. **Treasurer Approval & Reimbursement:** Treasurer reviews claim in queue, approves it (creates liability in *Owed to Volunteers*), and reimburses it (writes atomic `OUT` / `EXPENSE` entry).
6. **Cryptographic Ledger Audit:** Navigate to **Finance → Audit**, run chain verification to inspect the 64-character head hash and 0 broken links.
7. **Semester Financial Report:** Navigate to **Finance → Semester Reports**, review income breakdown by source and download formatted CSV / print HTML document.
