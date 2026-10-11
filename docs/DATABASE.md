# Database design (PostgreSQL via Prisma)

Source of truth: `backend/prisma/schema.prisma`. Migrations are additive and never edit earlier ones:
`0_init` → `0_init_1_schema_sync` → `1_enhancements` → `2_three_roles_merch` → `3_schema_optimization` → **`4_membership_tasks_announcements`**.

## Principles

1. **Read, don't count.** Totals the UI shows on every page are stored, and kept correct by database triggers.
2. **Index for the query that actually runs**: composite indexes in `WHERE → ORDER BY` order, not one index per column.
3. **Let the database refuse bad data** (foreign keys, unique constraints, CHECKs) so correctness does not depend on every code path.
4. **History is never cascaded away**: ledger rows have no foreign key to events; orders snapshot price/name and survive deleted products or accounts.

## Stored counters (maintained by triggers — never write them from the app)

| Column | Meaning | Replaces this query |
|---|---|---|
| `Event.pendingCount / confirmedCount / rejectedCount` | registrations per status | `registration.count`, `groupBy(eventId,status)` in event lists, the manage list, event detail, capacity checks, club dashboards |
| active seats | `pendingCount + confirmedCount` | `activeCounts()` in `events.service.ts` |
| `Team.memberCount` | pending + confirmed members | the member count in `joinTeam` |
| `Club.eventCount / productCount` | non-archived events / products | `_count` sub-queries in the admin club list |
| `Product.totalStock` | stock of active variants | summing variants to show "in stock / sold out" or to filter sold-out items |
| `Profile.unreadNotificationCount` | unread notifications | counting the last 50 notifications in memory (which was also wrong beyond 50) |
| `Registration.clubId` | the event's club (filled on insert) | joining `Registration → Event` to scope by club |

`npm run db:verify-counters` recomputes all of them and reports drift (`-- --fix` repairs). It has never found drift in testing; use it after restoring a backup or bulk-loading with triggers disabled.

Counters change by deltas inside the same transaction as the change they describe, so concurrent writers cannot overwrite each other, and they never go below zero.

## Indexes, by the query they serve

| Table | Index | Serves |
|---|---|---|
| Event | `(isPublished, isArchived, eventDate)` | public catalogue, date order |
| Event | `(clubId, isArchived, eventDate)` | a club's events (and the FK) |
| Event | trigram on `name`, `venue` | search box |
| Registration | `(eventId, status, createdAt)` | per-event review lists and counts |
| Registration | `(userId, status, createdAt)` | a student's tickets / profile counters |
| Registration | `(clubId, status, createdAt)`, `(status, createdAt)` | club-wide and admin lists |
| Registration | `(teamId, status)`, `(transactionId)` | team roster, duplicate payment reference |
| Profile | `(clubId, role)`, `(role, isActive)`, `(fullName, id)`, `(createdAt)` | admin user list: filter + sort |
| Profile | trigram on `fullName`, `email`, `usn` | user search |
| Club / Product | `(isArchived, name)` / `(isPublished, isArchived, createdAt)`, `(clubId, isArchived, createdAt)`, trigram on name | club + merchandise lists and search |
| Order | `(userId, createdAt)`, `(clubId, status, createdAt)`, `(status, createdAt)`, FK indexes on product/variant | order history, club queue, admin view |
| Notification | `(userId, createdAt)`, `(userId, isRead)` | the bell |
| RegistrationKey | `(isUsed, expiresAt)`, `(createdAt)`, trigram on `code` | key list and search |
| AuditLog | `(createdAt)`, `(entityType, createdAt)`, `(action, createdAt)`, `(actorId, createdAt)` | the admin audit list (always newest first) |
| LedgerEntry / ExpenseClaim | `(clubId, createdAt)`, `(createdAt)`; `(clubId, status, createdAt)`, `(claimantId, createdAt)` | finance summaries, approval queue |

Search uses `pg_trgm`, so case-insensitive `contains` queries (`ILIKE '%x%'`, Prisma `contains` + `mode: 'insensitive'`) use an index. Verified: on 50,000 rows Postgres picks the trigram and composite indexes (see `tests/schema.test.ts`).

## Memberships, member pricing, tasks, announcements (migration 4)

| Model / column | Rule |
|---|---|
| `Membership` | One row per dues payment (history kept). Active = `status = ACTIVE` and `endDate` in the future, so expiry needs no job. A renewal starts when the current period ends. At most one `PENDING` row per student and club (trigger + advisory lock). |
| `Club.membershipFeePaise / membershipMonths` | The club's dues and period (0 dues = free, instant membership). |
| `Event.memberFee` | Optional price for active members; never above `fee`. |
| `Product.memberDiscountPercent` | 0–100, applied at checkout for active members of the selling club. |
| `Registration.feeCharged / isMemberPrice` | The price fixed when the student registered. Ledger postings, payment checks and admin totals read this, not `Event.fee`. A trigger fills it from the event fee if an insert omits it. |
| `Order.isMemberPrice` | Whether the stored `unitPricePaise` was the member price. |
| `EventTask` + `Event.taskCount / taskDoneCount` | Volunteer tasks; the counters are trigger-maintained like the registration counters. |
| `Announcement` | Club feed; posting bulk-notifies active members. |

Dues are recorded in the ledger as category `DUES` (already part of the report and summary breakdown).
All member/guest decisions go through `modules/memberships/membership.service.ts`; do not re-implement them.

## Integrity rules enforced by the database

- A `CLUB_HEAD` always has a club; a `STUDENT` or `SUPER_ADMIN` never does (`chk_profile_role_club`).
- Event fee ≥ 0 and capacity > 0 (new/changed rows; run `VALIDATE CONSTRAINT` after reviewing legacy data).
- Counters ≥ 0; variant stock ≥ 0; order total = unit price × quantity.
- New foreign keys: `Notification.user → Profile` (cascade), `RegistrationKey.createdBy → Profile` (set null).
- Already in place: one registration per student per event, unique emails/USNs/passkeys/key codes/payment references, unique ledger reference.

## Writing queries from here

- Read counters directly (`event.pendingCount + event.confirmedCount`); do **not** `count()` or `groupBy` registrations for a list page.
- Filter club-scoped registrations with `where: { clubId }`; no relation filter needed.
- Keep list filters in index order (e.g. `isPublished, isArchived` then order by `eventDate`).
- Keep searching `name`/`venue`/`fullName`/`email`/`usn`/`code`; avoid `contains` on `description` (not indexed).
- Never `update`/`create` a counter column; change the underlying row and the trigger does the rest.

## Deliberately not changed (and why)

- `Event.fee` is a `Float`. Money should be integer paise or `Decimal`; changing it alters the API shape for all clients, so it needs its own change.
- Event dates are stored as "floating" wall-clock values (see `utils/time.ts`).
- Platform-wide admin totals are still computed on demand: they are low-traffic and index-backed, so a counter table is not worth the extra moving parts.

## Applying to an existing database (Supabase)

1. Back up. 2. `prisma migrate resolve --applied 0_init` (baseline) 3. `prisma migrate deploy`. The migration needs `CREATE EXTENSION pg_trgm` (allowed on Supabase). It removes notifications that belong to deleted users, detaches super admins from clubs, and aligns profile roles with club links (a profile with a club is a club head; a club head without a club is a student).
