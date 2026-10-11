process.env.MAIL_TRANSPORT = 'memory';
import { Role } from '@prisma/client';
import prisma from '../config/db';
import app from '../index';
import { check, clubByEmail, createRunner, eq, eventBody, makeUser, seeded, startServer, uid } from './helpers';

/**
 * Three-role access control: SUPER_ADMIN / CLUB_HEAD / STUDENT.
 * Covers anonymous access, privilege escalation attempts, club isolation and admin powers.
 */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('🔐 RBAC: anonymous, student, club head and super admin');
  const { api } = srv;

  const admin = await seeded('admin@skyline.local');
  const gdgHead = await seeded('aarav.gdg@college.edu');
  const ieeeHead = await seeded('ieee.head@college.edu');
  const gdg = await clubByEmail('gdg@college.edu');
  const ieee = await clubByEmail('ieee@college.edu');
  const student = await makeUser('student');
  const cleanup: Array<() => Promise<unknown>> = [() => prisma.profile.deleteMany({ where: { id: student.id } })];

  // Private events for isolation checks
  const ieeeEvent = await prisma.event.create({
    data: { clubId: ieee.id, name: `IEEE private ${uid()}`, description: '', eventType: 'Solo', registrationLimit: 10, eventDate: new Date(Date.now() + 5 * 864e5), isPublished: true },
  });
  const unpublished = await prisma.event.create({
    data: { clubId: gdg.id, name: `GDG draft ${uid()}`, description: '', eventType: 'Solo', registrationLimit: 10, eventDate: new Date(Date.now() + 5 * 864e5), isPublished: false },
  });
  cleanup.push(() => prisma.event.deleteMany({ where: { id: { in: [ieeeEvent.id, unpublished.id] } } }));

  try {
    // ── Anonymous ────────────────────────────────────────────────────────────
    await test('anonymous visitors can browse published events without logging in', async () => {
      const r = await api('GET', '/events');
      eq(r.status, 200, 'status');
      check(r.data.events.length > 0, 'expected events');
      check(r.data.events.every((e: any) => e.registrationState), 'every event exposes its registration state');
    });

    await test('public event data never exposes registrants, keys or internal flags', async () => {
      const r = await api('GET', '/events');
      const raw = JSON.stringify(r.data);
      for (const leak of ['registrations', 'transaction', 'passkey', 'password', 'isArchived', '"email"']) {
        check(!raw.includes(leak), `public events response leaks "${leak}"`);
      }
    });

    await test('unpublished events are hidden from anonymous list and detail, visible to their club head', async () => {
      const list = await api('GET', `/events?search=${encodeURIComponent(unpublished.name)}`);
      eq(list.data.events.length, 0, 'public list');
      eq((await api('GET', `/events/${unpublished.id}`)).status, 404, 'anonymous detail');
      eq((await api('GET', `/events/${unpublished.id}`, { token: student.token })).status, 404, 'student detail');
      eq((await api('GET', `/events/${unpublished.id}`, { token: ieeeHead.token })).status, 404, 'other club head detail');
      eq((await api('GET', `/events/${unpublished.id}`, { token: gdgHead.token })).status, 200, 'own club head detail');
    });

    await test('anonymous users cannot register, buy, or open any protected API (401)', async () => {
      const calls: Array<[string, string, unknown?]> = [
        ['POST', '/register', { eventId: ieeeEvent.id }],
        ['POST', '/teams/create', { eventId: ieeeEvent.id, teamName: 'x' }],
        ['POST', '/merchandise/orders', { productId: 'x', variantId: 'y', quantity: 1 }],
        ['GET', '/user/tickets'],
        ['GET', '/profiles/me'],
        ['GET', '/notifications'],
        ['POST', '/events', eventBody()],
        ['GET', '/events/manage/list'],
        ['GET', '/admin/stats'],
        ['GET', '/admin/users'],
        ['GET', '/finance/summary'],
        ['GET', '/expenses'],
      ];
      for (const [m, p, b] of calls) eq((await api(m, p, { body: b })).status, 401, `${m} ${p}`);
    });

    await test('malformed or forged tokens are rejected (401)', async () => {
      eq((await api('GET', '/profiles/me', { token: 'not-a-token' })).status, 401, 'garbage');
      const forged = (await import('jsonwebtoken')).default.sign({ userId: admin.id }, 'wrong-secret');
      eq((await api('GET', '/admin/stats', { token: forged })).status, 401, 'wrong secret');
    });

    // ── Student ──────────────────────────────────────────────────────────────
    await test('students get 403 on every admin and club-management API', async () => {
      const calls: Array<[string, string, unknown?]> = [
        ['GET', '/admin/stats'], ['GET', '/admin/users'], ['GET', '/admin/clubs'], ['GET', '/admin/registrations'],
        ['GET', '/admin/registration-keys'], ['POST', '/admin/registration-keys/generate', {}], ['GET', '/admin/audit-logs'],
        ['PUT', `/admin/users/${student.id}/role`, { role: 'SUPER_ADMIN' }],
        ['POST', '/events', eventBody()], ['GET', '/events/manage/list'],
        ['GET', `/events/${ieeeEvent.id}/registrations`], ['PUT', `/events/${ieeeEvent.id}`, { name: 'hijack' }],
        ['DELETE', `/events/${ieeeEvent.id}`], ['GET', '/finance/summary'], ['GET', '/expenses'],
        ['POST', '/merchandise/manage/products', {}], ['GET', '/merchandise/manage/orders'],
      ];
      for (const [m, p, b] of calls) eq((await api(m, p, { token: student.token, body: b })).status, 403, `${m} ${p}`);
    });

    await test('a student cannot read another user\'s profile, stats or tickets', async () => {
      eq((await api('GET', `/profiles/${gdgHead.id}`, { token: student.token })).status, 404, 'profile');
      eq((await api('GET', `/profiles/${gdgHead.id}/stats`, { token: student.token })).status, 404, 'stats');
      eq((await api('GET', `/profiles/${student.id}`, { token: student.token })).status, 200, 'own profile');
    });

    await test('public sign-up always creates a STUDENT even if the body asks for a higher role', async () => {
      const email = `escalate_${uid()}@test.skyline`;
      const r = await api('POST', '/auth/signup', { body: { email, password: 'Password1', name: 'Eve', role: 'SUPER_ADMIN', clubId: gdg.id } });
      eq(r.status, 201, 'signup status');
      eq(r.data.profile.role, 'STUDENT', 'role');
      eq(r.data.profile.clubId, null, 'clubId');
      check(!('password' in r.data.profile), 'password hash must not be returned');
      cleanup.push(() => prisma.profile.deleteMany({ where: { email } }));
    });

    await test('profile edit cannot change role, club, email or password', async () => {
      const r = await api('PUT', '/profiles/edit', { token: student.token, body: { role: 'SUPER_ADMIN', clubId: gdg.id, email: 'x@y.z', password: 'hax', branch: 'CSE' } });
      eq(r.status, 200, 'status');
      const after = await prisma.profile.findUniqueOrThrow({ where: { id: student.id } });
      eq(after.role, Role.STUDENT, 'role');
      eq(after.clubId, null, 'clubId');
      eq(after.email, student.email, 'email');
      eq(after.branch, 'CSE', 'allowed field updated');
    });

    // ── Club head ────────────────────────────────────────────────────────────
    await test('club head sees only their own club in the managed event list', async () => {
      const r = await api('GET', '/events/manage/list?pageSize=100', { token: gdgHead.token });
      eq(r.status, 200, 'status');
      check(r.data.items.length > 0, 'has events');
      check(r.data.items.every((e: any) => e.clubId === gdg.id), 'foreign club event leaked');
      eq((await api('GET', `/events/manage/list?clubId=${ieee.id}`, { token: gdgHead.token })).status, 403, 'other club scope');
    });

    await test('club head cannot read, edit, publish, close or delete another club\'s event by ID', async () => {
      const t = gdgHead.token;
      eq((await api('GET', `/events/${ieeeEvent.id}/registrations`, { token: t })).status, 403, 'registrations');
      eq((await api('PUT', `/events/${ieeeEvent.id}`, { token: t, body: { name: 'pwned' } })).status, 403, 'edit');
      eq((await api('POST', `/events/${ieeeEvent.id}/close-registration`, { token: t })).status, 403, 'close');
      eq((await api('POST', `/events/${ieeeEvent.id}/unpublish`, { token: t })).status, 403, 'unpublish');
      eq((await api('DELETE', `/events/${ieeeEvent.id}`, { token: t })).status, 403, 'delete');
      eq((await api('PUT', `/clubs/${ieee.id}`, { token: t, body: { name: 'pwned' } })).status, 403, 'club edit');
      eq((await api('GET', `/clubs/${ieee.id}/dashboard-stats`, { token: t })).status, 403, 'club dashboard');
      eq((await prisma.event.findUniqueOrThrow({ where: { id: ieeeEvent.id } })).name.startsWith('IEEE private'), true, 'event untouched');
    });

    await test('club head cannot create an event in another club (body clubId is ignored)', async () => {
      const r = await api('POST', '/events', { token: gdgHead.token, body: eventBody({ clubId: ieee.id }) });
      eq(r.status, 201, 'status');
      eq(r.data.event.clubId, gdg.id, 'created under own club');
      cleanup.push(() => prisma.event.deleteMany({ where: { id: r.data.event.id } }));
    });

    await test('club head cannot use admin APIs or other clubs\' finance data', async () => {
      eq((await api('GET', '/admin/stats', { token: gdgHead.token })).status, 403, 'admin stats');
      eq((await api('GET', `/finance/ledger?clubId=${ieee.id}`, { token: gdgHead.token })).status, 403, 'foreign ledger');
      eq((await api('GET', `/finance/summary?clubId=${ieee.id}`, { token: gdgHead.token })).status, 403, 'foreign summary');
      const own = await api('GET', '/finance/ledger?pageSize=100', { token: gdgHead.token });
      eq(own.status, 200, 'own ledger');
      check(own.data.entries.every((e: any) => e.clubId === gdg.id), 'ledger leaked foreign entries');
    });

    await test('club head cannot change their own role or club through any endpoint', async () => {
      await api('PUT', '/profiles/edit', { token: gdgHead.token, body: { role: 'SUPER_ADMIN', clubId: ieee.id } });
      const after = await prisma.profile.findUniqueOrThrow({ where: { id: gdgHead.id } });
      eq(after.role, Role.CLUB_HEAD, 'role');
      eq(after.clubId, gdg.id, 'club');
    });

    // ── Super admin ──────────────────────────────────────────────────────────
    await test('super admin reads platform-wide stats from real data', async () => {
      const r = await api('GET', '/admin/stats', { token: admin.token });
      eq(r.status, 200, 'status');
      const s = r.data.stats;
      eq(s.clubs.total, await prisma.club.count(), 'clubs');
      eq(s.users.total, await prisma.profile.count(), 'users');
      eq(s.registrations.confirmed, await prisma.registration.count({ where: { status: 'CONFIRMED' } }), 'confirmed registrations');
    });

    await test('super admin can view and edit any club\'s events and registrations', async () => {
      eq((await api('GET', `/events/${ieeeEvent.id}/registrations`, { token: admin.token })).status, 200, 'registrations');
      const edit = await api('PUT', `/events/${ieeeEvent.id}`, { token: admin.token, body: { venue: 'Admin Hall' } });
      eq(edit.status, 200, 'edit');
      eq(edit.data.event.venue, 'Admin Hall', 'venue');
      const all = await api('GET', '/events/manage/list?pageSize=100', { token: admin.token });
      check(new Set(all.data.items.map((e: any) => e.clubId)).size > 1, 'admin should see multiple clubs');
    });

    await test('admin user listing excludes secrets and paginates/filters/searches', async () => {
      const r = await api('GET', '/admin/users?role=STUDENT&pageSize=5&page=1', { token: admin.token });
      eq(r.status, 200, 'status');
      check(r.data.items.length <= 5 && r.data.pagination.pageSize === 5, 'page size respected');
      check(r.data.items.every((u: any) => u.role === 'STUDENT'), 'role filter');
      const raw = JSON.stringify(r.data);
      check(!raw.includes('password') && !raw.includes('Reset'), 'secret fields leaked');
      const found = await api('GET', `/admin/users?search=${encodeURIComponent(student.email)}`, { token: admin.token });
      eq(found.data.pagination.totalItems, 1, 'search total');
    });

    await test('role changes: club head needs a club, students detach, self and last-admin protected', async () => {
      const target = await makeUser('promote');
      cleanup.push(() => prisma.profile.deleteMany({ where: { id: target.id } }));
      eq((await api('PUT', `/admin/users/${target.id}/role`, { token: admin.token, body: { role: 'CLUB_HEAD' } })).status, 400, 'club required');
      const ok = await api('PUT', `/admin/users/${target.id}/role`, { token: admin.token, body: { role: 'CLUB_HEAD', clubId: ieee.id } });
      eq(ok.status, 200, 'promote');
      eq(ok.data.user.clubId, ieee.id, 'assigned club');
      // The promoted head can now manage IEEE, but not GDG.
      eq((await api('GET', `/events/${ieeeEvent.id}/registrations`, { token: target.token })).status, 200, 'new head can manage own club');
      eq((await api('GET', `/events/${unpublished.id}/registrations`, { token: target.token })).status, 403, 'new head cannot manage other club');
      const back = await api('PUT', `/admin/users/${target.id}/role`, { token: admin.token, body: { role: 'STUDENT' } });
      eq(back.data.user.clubId, null, 'student has no club');
      eq((await api('PUT', `/admin/users/${admin.id}/role`, { token: admin.token, body: { role: 'STUDENT' } })).status, 403, 'self change');
      eq((await api('PUT', `/admin/users/${admin.id}/status`, { token: admin.token, body: { isActive: false } })).status, 403, 'self deactivate');
      eq((await api('PUT', `/admin/users/${target.id}/role`, { token: admin.token, body: { role: 'ADMIN' } })).status, 400, 'legacy role rejected');
    });

    await test('deactivated accounts lose access immediately and cannot log in', async () => {
      const victim = await makeUser('deactivate');
      cleanup.push(() => prisma.profile.deleteMany({ where: { id: victim.id } }));
      eq((await api('GET', '/profiles/me', { token: victim.token })).status, 200, 'before');
      eq((await api('PUT', `/admin/users/${victim.id}/status`, { token: admin.token, body: { isActive: false } })).status, 200, 'deactivate');
      eq((await api('GET', '/profiles/me', { token: victim.token })).status, 403, 'token after deactivation');
      eq((await api('POST', '/auth/login', { body: { email: victim.email, password: 'Password@123' } })).status, 403, 'login');
      await api('PUT', `/admin/users/${victim.id}/status`, { token: admin.token, body: { isActive: true } });
      eq((await api('GET', '/profiles/me', { token: victim.token })).status, 200, 'after reactivation');
    });

    await test('club lifecycle: create, assign head, archive hides from public, delete guarded', async () => {
      const email = `club_${uid()}@test.skyline`;
      const created = await api('POST', '/admin/clubs', { token: admin.token, body: { name: `Temp Club ${uid()}`, email, password: 'Password1' } });
      eq(created.status, 201, 'create');
      const clubId = created.data.club.id;
      check(!('password' in created.data.club), 'club password leaked');
      cleanup.push(() => prisma.profile.deleteMany({ where: { clubId } }).then(() => prisma.club.deleteMany({ where: { id: clubId } })));

      const login = await api('POST', '/auth/club-login', { body: { email, password: 'Password1' } });
      eq(login.status, 200, 'club login');
      eq(login.data.profile.role, 'CLUB_HEAD', 'club login role');

      const ev = await api('POST', '/events', { token: login.data.token, body: eventBody() });
      eq(ev.status, 201, 'head creates event');
      check((await api('GET', `/events?clubId=${clubId}`)).data.events.length === 1, 'event public before archive');

      eq((await api('POST', `/admin/clubs/${clubId}/archive`, { token: admin.token })).status, 200, 'archive');
      eq((await api('GET', `/events?clubId=${clubId}`)).data.events.length, 0, 'event hidden after archive');
      check(!(await api('GET', '/clubs')).data.clubs.some((c: any) => c.id === clubId), 'club hidden after archive');
      eq((await api('POST', '/auth/club-login', { body: { email, password: 'Password1' } })).status, 403, 'archived club cannot log in');

      eq((await api('DELETE', `/admin/clubs/${clubId}`, { token: admin.token, body: {} })).status, 400, 'delete needs confirmation');
      const del = await api('DELETE', `/admin/clubs/${clubId}`, { token: admin.token, body: { confirm: created.data.club.name } });
      eq(del.status, 200, 'delete club without history');
    });

    await test('every admin mutation is written to the audit log', async () => {
      const r = await api('GET', '/admin/audit-logs?pageSize=100', { token: admin.token });
      eq(r.status, 200, 'status');
      const actions = new Set(r.data.items.map((l: any) => l.action));
      for (const a of ['UPDATE_USER_ROLE', 'DEACTIVATE_USER', 'CREATE_CLUB', 'ARCHIVE_CLUB']) check(actions.has(a), `missing audit action ${a}`);
      check(r.data.items.every((l: any) => !/SKYLINE-(?!\*{4})[A-Z0-9]/i.test(JSON.stringify(l))), 'audit log must not contain full keys (only masked SKYLINE-****)');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn().catch(() => {});
    await srv.close();
    summary();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
