# SkylineOS REST API Specification

Base URL (Production): `https://skyline27.onrender.com/api`  
Base URL (Local): `http://localhost:5000/api`

All protected endpoints require an `Authorization: Bearer <token>` HTTP header. User identity and roles are verified directly against the database on every request.

---

## 1. Authentication & Session (`/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Student sign-up (`fullName`, `email`, `password`, `usn`, `branch`, `year`, `sem`) |
| `POST` | `/auth/login` | Public | Student sign-in (`email`, `password`), returns JWT token + profile |
| `POST` | `/auth/club-login` | Public | Club Head sign-in (`email`, `password`), returns JWT token + profile |
| `POST` | `/auth/admin-login` | Public | Super Admin sign-in (`email`, `password`), returns JWT token + profile |
| `POST` | `/auth/google` | Public | Google OAuth 2.0 credential sign-in / registration |
| `POST` | `/auth/verify-key` | Public | Verify club registration key (`code`) |
| `POST` | `/auth/forgot-password` | Public | Request password reset token via email |
| `POST` | `/auth/reset-password` | Public | Reset password using verified token |
| `POST` | `/auth/change-password` | Authenticated | Change password for current logged-in user |

---

## 2. Events (`/events`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/events` | Public | List published events with query filters (`search`, `category`, `from`, `to`, `page`, `limit`) |
| `GET` | `/events/:id` | Public | Event detail including pricing, active seats, and capacity |
| `POST` | `/events` | `CLUB_HEAD` | Create new event (`name`, `fee`, `memberFee`, `registrationLimit`, `eventDate`, etc.) |
| `PUT` | `/events/:id` | `CLUB_HEAD` | Update existing event details |
| `PATCH` | `/events/:id/deadline` | `CLUB_HEAD` | Update registration deadline (evaluated in campus timezone) |
| `PATCH` | `/events/:id/status` | `CLUB_HEAD` | Toggle publish state or manually close registrations |
| `POST` | `/events/verify-ticket` | `CLUB_HEAD` | Scan and verify door QR passkey, mark attendance timestamp |

---

## 3. Registrations & Ticketing (`/registrations`, `/register`, `/teams`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | `STUDENT` | Register for event (solo or create team); calculates member pricing dynamically |
| `GET` | `/registrations/my` | `STUDENT` | Retrieve student's ticket wallet with QR codes and passkeys |
| `GET` | `/registrations/event/:id`| `CLUB_HEAD` | Paginated attendee and payment proof review queue |
| `PATCH` | `/registrations/:id/approve` | `CLUB_HEAD` | Approve ticket registration (updates status to `CONFIRMED`, posts to ledger if paid) |
| `PATCH` | `/registrations/:id/reject` | `CLUB_HEAD` | Reject ticket registration with note |
| `POST` | `/teams/join` | `STUDENT` | Join an existing team using its secret passkey |

---

## 4. Club Memberships (`/memberships`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/memberships/my` | `STUDENT` | Retrieve logged-in student's active and historical club memberships |
| `POST` | `/memberships/join` | `STUDENT` | Submit membership dues payment proof or claim free membership tier |
| `GET` | `/memberships/club/:id` | `CLUB_HEAD` | Review club member roster and pending verification queue |
| `PATCH` | `/memberships/:id/verify` | `CLUB_HEAD` | Verify dues payment, activate membership, and post `DUES` entry to ledger |

---

## 5. Campus Merchandise (`/merchandise`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/merchandise` | Public | Browse published products with live stock indicators |
| `GET` | `/merchandise/:id` | Public | Product detail with active size/color variants |
| `POST` | `/merchandise` | `CLUB_HEAD` | Create product with variants, stock quantities, and `memberDiscountPercent` |
| `PUT` | `/merchandise/:id` | `CLUB_HEAD` | Update product details and inventory |
| `POST` | `/merchandise/order` | `STUDENT` | Place order with transactional atomic stock decrement |
| `GET` | `/merchandise/orders/my` | `STUDENT` | Retrieve logged-in student's order history |
| `GET` | `/merchandise/orders/club`| `CLUB_HEAD` | Club order fulfillment queue |
| `PATCH` | `/merchandise/orders/:id/status` | `CLUB_HEAD` | Update order status (`PAID`, `CANCELLED`, `REJECTED`) |

---

## 6. Volunteer Tasks (`/tasks`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/tasks/event/:eventId` | Authenticated | Retrieve task Kanban board for an event (`TODO`, `IN_PROGRESS`, `DONE`) |
| `POST` | `/tasks` | `CLUB_HEAD` | Create an event task |
| `PATCH` | `/tasks/:id/status` | Authenticated | Update task status |
| `PATCH` | `/tasks/:id/assign` | Authenticated | Self-assign or assign volunteer to task |

---

## 7. Club Announcements (`/announcements`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/announcements/club/:clubId` | Public | Retrieve club announcement timeline |
| `POST` | `/announcements` | `CLUB_HEAD` | Broadcast announcement (`MEETING`, `DEADLINE`, `GENERAL`) and auto-notify members |

---

## 8. Expense Claims (`/expenses`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/expenses` | `STUDENT` / Volunteer | Submit receipt-backed claim (`amountPaise`, `receiptUrl`, `scannedAmount`) |
| `GET` | `/expenses/my` | Authenticated | Retrieve user's own submitted claims |
| `GET` | `/expenses/club` | `CLUB_HEAD` | Review club expense claims queue (mismatch receipts flagged) |
| `PATCH` | `/expenses/:id/approve` | `CLUB_HEAD` | Approve claim (strictly rejects self-approval with HTTP 403; creates liability) |
| `PATCH` | `/expenses/:id/reject` | `CLUB_HEAD` | Reject claim with decision note |
| `POST` | `/expenses/:id/reimburse` | `CLUB_HEAD` | Mark reimbursed and write atomic `OUT` / `EXPENSE` transaction to the ledger |

---

## 9. Cryptographic Financial Ledger & Reports (`/finance`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/finance/summary` | `CLUB_HEAD` | Real-time income, expenses, net balance, liabilities (*Owed to Volunteers*), and event P&L |
| `GET` | `/finance/ledger` | `CLUB_HEAD` | Paginated, filtered ledger entries (`category`, `type`, `eventId`, `from`, `to`) |
| `GET` | `/finance/audit/verify` | `CLUB_HEAD` / Admin | Verify cryptographic SHA-256 chain integrity from genesis to head hash |
| `GET` | `/finance/report` | `CLUB_HEAD` | Generate complete semester financial report in JSON |
| `GET` | `/finance/report/csv` | `CLUB_HEAD` | Download formatted semester financial report CSV |
| `GET` | `/finance/report/html` | `CLUB_HEAD` | View print-ready formatted semester financial statement HTML |
| `GET` | `/finance/report/pdf` | `CLUB_HEAD` | Download crisp vector PDF financial statement generated via PDFKit |

---

## 10. Super Admin Console (`/admin`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/admin/overview` | `SUPER_ADMIN` | Platform telemetry: total clubs, events, users, volume |
| `GET` | `/admin/users` | `SUPER_ADMIN` | Paginated user directory with `pg_trgm` fuzzy search |
| `PATCH` | `/admin/users/:id/status` | `SUPER_ADMIN` | Toggle user active status (activate/ban) |
| `GET` | `/admin/clubs` | `SUPER_ADMIN` | Global club directory and status management |
| `POST` | `/admin/keys` | `SUPER_ADMIN` | Generate single-use, expiring club registration keys |
| `GET` | `/admin/keys` | `SUPER_ADMIN` | Inspect active, used, and expired registration keys |
| `GET` | `/admin/audit-logs` | `SUPER_ADMIN` | Paginated system-wide immutable audit trail |

---

## 11. Notifications & Profiles (`/notifications`, `/profiles`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/notifications` | Authenticated | User's notifications feed |
| `PATCH` | `/notifications/:id/read` | Authenticated | Mark notification as read (updates cached trigger counter) |
| `PATCH` | `/notifications/read-all` | Authenticated | Mark all notifications as read |
| `GET` | `/profiles/me` | Authenticated | Current user profile details and counters |
| `PUT` | `/profiles/me` | Authenticated | Update user profile details |
| `GET` | `/profiles/saved-events` | `STUDENT` | Retrieve student's saved/bookmarked events |
| `POST` | `/profiles/saved-events/:eventId`| `STUDENT` | Toggle bookmark status for an event |
