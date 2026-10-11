# SkylineOS architecture

**One website** (`frontend/`), **one backend** (`backend/`), and one place where permissions are decided.

| Role | Chosen on the landing page | Sign in / sign up | Lands on |
|---|---|---|---|
| Visitor | "Browse events" | none needed | public pages |
| `STUDENT` | **Student** | `/login`: sign in and sign up | `/home` |
| `CLUB_HEAD` | **Club head** | `/club/auth`: sign in, or register the club with an authorization key / Google | `/club` |
| `SUPER_ADMIN` | **Admin** | `/admin/login`: sign in only (admins are created by the platform owner) | `/admin` |

Each sign-in only accepts its own role. A protected page sends a visitor to the matching one (`loginUrl()` in `shared/session.ts`).

`/` is the SkylineOS landing page for visitors, with the three role options; anyone already signed in is redirected straight to their own area.
Exactly three roles exist (`enum Role`). Legacy `ADMIN/TREASURER/VOLUNTEER/MEMBER` values were folded into them by migration `2_three_roles_merch`. The website has no mobile app or PWA install; it is responsive and works in any browser.

## Frontend (`frontend/src/`)

```
main.tsx          providers: Router, Theme, Auth
app/App.tsx       the route table (the only place that knows every area)
shared/           session.ts (ONE token + profile for the whole site), AuthProvider, guards
                  (RequireRole / PublicOnly), theme, config (API base URL)
student/          public + student area: pages, stores, API calls, student.css
club/             club dashboard (App.tsx, finance, events, merchandise)
admin/            super admin console: AdminRoutes.tsx + modules/ (users, clubs, events, ...)
```

- **Role-specific sign-in:** students use `POST /auth/login`, club heads `POST /auth/club-login` (or Google with a key), admins `POST /auth/admin-login`. After sign-in `destinationFor()` sends each role to its own area, honouring a `?redirect=` only when that role may open it.
- **Guards only shape navigation.** `RequireRole` hides areas from the wrong role, but every API call is authorised again on the server.
- **Code splitting:** the admin console and the club dashboard are lazy-loaded, so public visitors download neither.
- **Styling isolation:** each area owns its stylesheet and scopes it (`.stu-root`, `.admin-root` with `ad-*` tokens, the club's shadcn tokens) so styles cannot leak between areas. All follow the site-wide light/dark toggle.

### Adding a page
- Public/student: add the page to `student/pages/` and a `<Route>` in `student/StudentLayout.tsx` (wrap in `RequireRole` if it needs an account).
- Admin: add a module under `admin/modules/` and a `<Route>` in `admin/AdminRoutes.tsx`.
- New role-specific area: add a lazy route in `app/App.tsx` guarded by `RequireRole`.

## Backend (`backend/`)

```
app.ts                  builds the Express app (helmet, CORS, routers, error handler)
index.ts                starts it
config/                 env.ts (all configuration), db.ts (Prisma)
middlewares/
  authenticate.ts       token -> req.user {id, role, clubId} (role is read from the DB, never the client)
  authorize.ts          THE rulebook: requireRole, requireClubManager, requireSuperAdmin,
                        assertClubAccess, resolveClubScope, canManageClub
  errorHandler.ts       HttpError + one JSON error shape
  rateLimit.ts          auth / recovery / sensitive limiters
modules/<feature>/      <feature>.routes.ts (HTTP) + <feature>.service.ts (rules/queries)
  auth  profiles  events  registrations  clubs  merchandise  admin  finance  notifications
utils/                  pagination, params (validation), audit, storage, mailer, csv, crypto, time
prisma/                 schema + additive migrations (0_init is never edited)
tests/                  npm test
```

### Adding a feature (the convention)

1. Create `modules/<name>/<name>.routes.ts` and `<name>.service.ts`.
2. Guard every route with a helper from `middlewares/authorize.ts`. For data that belongs to a club, load the record and call `assertClubAccess(user, record.clubId)`; for lists use `resolveClubScope(user, req.query.clubId)` so a club head can only ever see their own club.
3. Lists use `parsePaginationParams` + `buildPaginatedResult` (`{ items, pagination }`), with search/filters applied in the query.
4. Write consequential actions to the audit log with `audit(...)`.
5. Mount the router in `app.ts`. Add tests to `tests/` and extend `tests/rbac.test.ts` with the new endpoints.

`/admin/*` is protected once, at the top of `admin.routes.ts`, so a new admin endpoint is secure by default.

### Key rules

- **Registration open?** one function, `events/events.service.ts#getRegistrationState`: unpublished/archived, manual close, opens-at, optional deadline (null = open until the event starts), event start, capacity.
- **Counts** come from `profiles/stats.service.ts` (student: active registrations; club head: their club's events; admin: platform). The old Events-vs-Profile mismatch was two different populations under one label.
- **Capacity / stock / keys** are enforced inside transactions (row lock on the event; conditional `UPDATE ... WHERE stock >= n`; conditional key claim), so concurrent requests cannot oversell.
- **Money**: server-side prices only, snapshotted on the order; ledger writes are idempotent on `(refType, refId, type)`.
- **Event times are floating wall-clock values** (what the clients already assume). Set `CAMPUS_UTC_OFFSET_MINUTES` so server-side deadlines match campus time.

## Design system

All three areas (student site, club dashboard, admin console) share one set of tokens in
`frontend/src/styles/tokens.css`, defined for light and dark (`--sk-canvas`, `--sk-surface`, `--sk-raised`,
`--sk-line`, `--sk-fg`, `--sk-muted`, `--sk-faint`, `--sk-brand`, status colours, radius, shadow, font).
The student (`--bg`, `--surface`, ...), admin (`--ad-*`) and shadcn/club (`--background`, ...) variables are aliases of these.

Light palette: Radix Colors "Sand" (warm off-white, no pure #fff surfaces). Dark: neutral near-black.
Rules: Inter is the only typeface; brand red is for primary actions, focus and the current-page marker only
(selected chips and tabs are neutral); 8px radius for controls, 12px for cards; borders rather than glows;
no decorative backgrounds. In Tailwind classes write colours as `text-[color:var(--sk-fg)]` (the bare
`text-[var(--x)]` form is ambiguous in Tailwind v4 and is not applied as a colour).

## Database

See `docs/DATABASE.md`: stored counters kept correct by triggers, composite and trigram indexes, integrity rules, and how to write queries against them.

## Environment

See `backend/.env.example`. Production requires `JWT_SECRET`; set `CORS_ORIGINS`, `SITE_URL` (the website's address, used in emailed links), SMTP settings (password reset email) and `CAMPUS_UTC_OFFSET_MINUTES`.

First Super Admin: `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create`, then sign in at `/login`.

## Testing

```
npm run db:deploy && npm run db:constraints && npm run db:seed && npm test
```

Use a disposable database (the ledger is append-only by trigger, so tests leave ledger rows behind; re-seed to reset).
