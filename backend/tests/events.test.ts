process.env.MAIL_TRANSPORT = 'memory';
import prisma from '../config/db';
import app from '../index';
import { check, clubByEmail, createRunner, eq, eventBody, futureDate, makeUser, seeded, startServer, uid } from './helpers';

/** Event management, registration rules, concurrency, count semantics and pagination. */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('📅 Events: lifecycle, registration, counts, pagination');
  const { api } = srv;

  const admin = await seeded('admin@skyline.local');
  const head = await seeded('aarav.gdg@college.edu');
  const otherHead = await seeded('rotaract.head@college.edu');
  const gdg = await clubByEmail('gdg@college.edu');
  const tag = uid();
  const created: string[] = [];
  const users: string[] = [];
  const student = async (p: string) => {
    const u = await makeUser(p);
    users.push(u.id);
    return u;
  };
  const newEvent = async (overrides: Record<string, unknown> = {}, token = head.token) => {
    const r = await api('POST', '/events', { token, body: eventBody({ name: `EVT-${tag}-${uid()}`, ...overrides }) });
    check(r.status === 201, `event create failed: ${r.status} ${r.text}`);
    created.push(r.data.event.id);
    return r.data.event as any;
  };

  try {
    // ── Create / edit / validate ────────────────────────────────────────────
    await test('create with NO registration closing date is valid and registration is open', async () => {
      const ev = await newEvent();
      eq(ev.registrationDeadline, null, 'deadline');
      eq(ev.registrationState, 'OPEN', 'state');
      const pub = await api('GET', `/events/${ev.id}`);
      eq(pub.data.event.registrationOpen, true, 'public open flag');
    });

    await test('edit needs only the session — no password — and validates fields on the server', async () => {
      const ev = await newEvent();
      const r = await api('PUT', `/events/${ev.id}`, { token: head.token, body: { name: `Renamed-${tag}`, venue: 'New Venue', fee: 0 } });
      eq(r.status, 200, 'edit status');
      eq(r.data.event.name, `Renamed-${tag}`, 'name');
      const bad = [
        { eventDate: 'not-a-date' },
        { fee: -5 },
        { registrationLimit: 0 },
        { name: '   ' },
        { eventEndDate: new Date(Date.now() - 864e5 * 365).toISOString() },
        { registrationOpensAt: futureDate(5).toISOString(), registrationDeadline: futureDate(2).toISOString() },
      ];
      for (const b of bad) eq((await api('PUT', `/events/${ev.id}`, { token: head.token, body: b })).status, 400, `validation ${JSON.stringify(b)}`);
    });

    await test('closing date can be set, cleared back to null, and a past deadline closes registration', async () => {
      const ev = await newEvent({ registrationDeadline: futureDate(3).toISOString() });
      check(ev.registrationDeadline, 'deadline set');
      const cleared = await api('PUT', `/events/${ev.id}`, { token: head.token, body: { registrationDeadline: null } });
      eq(cleared.data.event.registrationDeadline, null, 'cleared');
      await prisma.event.update({ where: { id: ev.id }, data: { registrationDeadline: new Date(Date.now() - 1000) } });
      const s = await api('GET', `/events/${ev.id}`);
      eq(s.data.event.registrationState, 'CLOSED', 'closed after deadline');
      const u = await student('late');
      const r = await api('POST', '/register', { token: u.token, body: { eventId: ev.id } });
      eq(r.status, 400, 'register after deadline');
    });

    await test('registration opening date: UPCOMING before it, OPEN after', async () => {
      const ev = await newEvent({ registrationOpensAt: futureDate(2).toISOString() });
      eq((await api('GET', `/events/${ev.id}`)).data.event.registrationState, 'UPCOMING', 'state');
      const u = await student('early');
      eq((await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).status, 400, 'too early');
      await prisma.event.update({ where: { id: ev.id }, data: { registrationOpensAt: new Date(Date.now() - 1000) } });
      eq((await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).status, 201, 'after opening');
    });

    await test('zone-less event times are floating wall-clock values (10:00 stays 10:00, whatever the server timezone)', async () => {
      const ev = await newEvent({ eventDate: '2031-05-01T10:00', eventEndDate: '2031-05-01T12:30', registrationDeadline: '2031-04-30T23:59' });
      eq(ev.eventDate, '2031-05-01T10:00:00.000Z', 'start');
      eq(ev.eventEndDate, '2031-05-01T12:30:00.000Z', 'end');
      eq(ev.registrationDeadline, '2031-04-30T23:59:00.000Z', 'deadline');
    });

    // ── Close / reopen / publish ─────────────────────────────────────────────
    await test('manual close blocks registration but keeps the event publicly visible; reopen restores it', async () => {
      const ev = await newEvent();
      const a = await student('a');
      const b = await student('b');
      eq((await api('POST', `/events/${ev.id}/close-registration`, { token: head.token })).status, 200, 'close');
      const detail = await api('GET', `/events/${ev.id}`);
      eq(detail.status, 200, 'still viewable');
      eq(detail.data.event.registrationState, 'CLOSED', 'state');
      check((await api('GET', `/events?search=${encodeURIComponent(ev.name)}`)).data.events.length === 1, 'still listed');
      const blocked = await api('POST', '/register', { token: a.token, body: { eventId: ev.id } });
      eq(blocked.status, 400, 'blocked');
      check(/closed/i.test(blocked.data.error), 'clear message');
      eq((await api('POST', `/events/${ev.id}/reopen-registration`, { token: head.token })).status, 200, 'reopen');
      eq((await api('POST', '/register', { token: b.token, body: { eventId: ev.id } })).status, 201, 'after reopen');
    });

    await test('publish / unpublish toggles public visibility', async () => {
      const ev = await newEvent({ isPublished: false });
      eq((await api('GET', `/events/${ev.id}`)).status, 404, 'hidden draft');
      const pub = await api('POST', `/events/${ev.id}/publish`, { token: head.token });
      eq(pub.status, 200, 'publish');
      eq((await api('GET', `/events/${ev.id}`)).status, 200, 'visible');
      await api('POST', `/events/${ev.id}/unpublish`, { token: head.token });
      eq((await api('GET', `/events/${ev.id}`)).status, 404, 'hidden again');
    });

    // ── Registration rules ───────────────────────────────────────────────────
    await test('duplicate registration is rejected (409) and only one row exists', async () => {
      const ev = await newEvent();
      const u = await student('dup');
      eq((await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).status, 201, 'first');
      eq((await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).status, 409, 'second');
      eq(await prisma.registration.count({ where: { eventId: ev.id, userId: u.id } }), 1, 'rows');
    });

    await test('simultaneous duplicate requests from one student create exactly one registration', async () => {
      const ev = await newEvent();
      const u = await student('race1');
      const rs = await Promise.all(Array.from({ length: 6 }, () => api('POST', '/register', { token: u.token, body: { eventId: ev.id } })));
      eq(rs.filter(r => r.status === 201).length, 1, 'created');
      eq(await prisma.registration.count({ where: { eventId: ev.id, userId: u.id } }), 1, 'rows');
    });

    await test('capacity is enforced under concurrent requests (limit 3, 10 students)', async () => {
      const ev = await newEvent({ registrationLimit: 3 });
      const us = await Promise.all(Array.from({ length: 10 }, (_, i) => student(`cap${i}`)));
      const rs = await Promise.all(us.map(u => api('POST', '/register', { token: u.token, body: { eventId: ev.id } })));
      eq(rs.filter(r => r.status === 201).length, 3, 'accepted');
      eq(rs.filter(r => r.status === 409).length, 7, 'refused as full');
      eq(await prisma.registration.count({ where: { eventId: ev.id } }), 3, 'rows');
      eq((await api('GET', `/events/${ev.id}`)).data.event.registrationState, 'SOLD_OUT', 'state');
    });

    await test('a rejected student can register again; their old row is reused, not duplicated', async () => {
      const ev = await newEvent({ fee: 50 });
      const u = await student('retry');
      const r1 = await api('POST', '/register', { token: u.token, body: { eventId: ev.id } });
      eq(r1.data.registration.status, 'PENDING', 'paid event starts pending');
      await api('PUT', `/registrations/${r1.data.registration.id}/payment`, { token: u.token, body: { transactionId: `UTR${uid()}${uid()}` } });
      eq((await api('DELETE', `/registrations/${r1.data.registration.id}/reject`, { token: head.token })).status, 200, 'reject');
      const r2 = await api('POST', '/register', { token: u.token, body: { eventId: ev.id } });
      eq(r2.status, 201, 'register again');
      eq(await prisma.registration.count({ where: { eventId: ev.id, userId: u.id } }), 1, 'single row');
    });

    await test('paid flow: payment reference required, unique, then club approval posts exactly one ledger entry', async () => {
      const ev = await newEvent({ fee: 120 });
      const u = await student('paid');
      const v = await student('paid2');
      const reg = (await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).data.registration;
      const reg2 = (await api('POST', '/register', { token: v.token, body: { eventId: ev.id } })).data.registration;
      eq((await api('PUT', `/registrations/${reg.id}/payment`, { token: u.token, body: { transactionId: '' } })).status, 400, 'empty ref');
      const utr = `UTR${uid()}${uid()}`.toUpperCase();
      eq((await api('PUT', `/registrations/${reg.id}/payment`, { token: u.token, body: { transactionId: utr } })).status, 200, 'submit');
      eq((await api('PUT', `/registrations/${reg2.id}/payment`, { token: v.token, body: { transactionId: utr } })).status, 409, 'reused reference');
      eq((await api('PUT', `/registrations/${reg.id}/payment`, { token: v.token, body: { transactionId: `X${uid()}${uid()}` } })).status, 404, "another student's registration");
      eq((await api('PUT', `/registrations/${reg.id}/approve`, { token: otherHead.token })).status, 403, 'other club cannot approve');
      eq((await api('PUT', `/registrations/${reg.id}/approve`, { token: head.token })).status, 200, 'approve');
      eq((await api('PUT', `/registrations/${reg.id}/approve`, { token: head.token })).status, 409, 'double approve refused');
      eq(await prisma.ledgerEntry.count({ where: { refType: 'registration', refId: reg.id } }), 1, 'one ledger entry');
      const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { refType: 'registration', refId: reg.id } });
      eq(entry.amountPaise, 12000, 'amount in paise');
    });

    // ── Delete / archive ─────────────────────────────────────────────────────
    await test('deleting an event with registrations archives it; history is kept and it leaves public view', async () => {
      const ev = await newEvent();
      const u = await student('hist');
      await api('POST', '/register', { token: u.token, body: { eventId: ev.id } });
      const r = await api('DELETE', `/events/${ev.id}`, { token: head.token });
      eq(r.status, 200, 'status');
      eq(r.data.archived, true, 'archived flag');
      check(await prisma.event.findUnique({ where: { id: ev.id } }), 'event row must still exist');
      eq(await prisma.registration.count({ where: { eventId: ev.id } }), 1, 'registration preserved');
      eq((await api('GET', `/events/${ev.id}`)).status, 404, 'hidden from public');
      eq((await api('DELETE', `/events/${ev.id}?force=true`, { token: head.token, body: { confirm: ev.name } })).status, 403, 'club head cannot force delete');
      eq((await api('DELETE', `/events/${ev.id}?force=true`, { token: admin.token, body: {} })).status, 400, 'force needs confirm');
      eq((await api('DELETE', `/events/${ev.id}?force=true`, { token: admin.token, body: { confirm: ev.name } })).status, 200, 'admin force');
      eq(await prisma.event.count({ where: { id: ev.id } }), 0, 'gone');
    });

    await test('deleting an event with no registrations removes it; restore brings an archived one back unpublished', async () => {
      const ev = await newEvent();
      eq((await api('DELETE', `/events/${ev.id}`, { token: head.token })).data.deleted, true, 'deleted');
      const ev2 = await newEvent();
      await api('POST', `/events/${ev2.id}/archive`, { token: head.token });
      const restored = await api('POST', `/events/${ev2.id}/restore`, { token: head.token });
      eq(restored.data.event.isArchived, false, 'restored');
      eq(restored.data.event.isPublished, false, 'stays unpublished');
    });

    await test('ledger rows survive hard deletion of an event (no cascade of financial history)', async () => {
      const ev = await newEvent({ fee: 10 });
      const u = await student('ledger');
      const reg = (await api('POST', '/register', { token: u.token, body: { eventId: ev.id } })).data.registration;
      await api('PUT', `/registrations/${reg.id}/payment`, { token: u.token, body: { transactionId: `UTR${uid()}${uid()}` } });
      await api('PUT', `/registrations/${reg.id}/approve`, { token: head.token });
      const before = await prisma.ledgerEntry.count({ where: { eventId: ev.id } });
      check(before === 1, 'ledger entry exists');
      const arch = await api('DELETE', `/events/${ev.id}`, { token: head.token });
      eq(arch.data.archived, true, 'archived because of history');
      await api('DELETE', `/events/${ev.id}?force=true`, { token: admin.token, body: { confirm: ev.name } });
      eq(await prisma.ledgerEntry.count({ where: { eventId: ev.id } }), before, 'ledger preserved');
    });

    // ── Count semantics (the Events vs Profile mismatch) ─────────────────────
    await test('profile counts follow their definition: registrations, not all events', async () => {
      const mine = await student('counts');
      const e1 = await newEvent();
      const e2 = await newEvent();
      const e3 = await newEvent();
      const publicTotal = (await api('GET', `/events?pageSize=100`)).data.pagination.totalItems;
      check(publicTotal >= 3, 'several public events exist');

      await api('POST', '/register', { token: mine.token, body: { eventId: e1.id } });
      const stats1 = (await api('GET', `/profiles/${mine.id}/stats`, { token: mine.token })).data;
      eq(stats1.role, 'STUDENT', 'role');
      eq(stats1.registrationsCount, 1, 'one registration, many public events');
      eq(stats1.eventsCount, 1, 'legacy alias matches');
      check(publicTotal > stats1.registrationsCount, 'events page is a different population');

      await api('POST', '/register', { token: mine.token, body: { eventId: e2.id } });
      eq((await api('GET', `/profiles/${mine.id}/stats`, { token: mine.token })).data.registrationsCount, 2, 'two registrations');

      // A rejected registration no longer counts.
      await prisma.registration.updateMany({ where: { eventId: e2.id, userId: mine.id }, data: { status: 'REJECTED' } });
      eq((await api('GET', `/profiles/${mine.id}/stats`, { token: mine.token })).data.registrationsCount, 1, 'rejected excluded');

      // An unpublished-but-registered event still counts for the student (they registered), archived does not.
      await api('POST', `/events/${e1.id}/archive`, { token: head.token });
      eq((await api('GET', `/profiles/${mine.id}/stats`, { token: mine.token })).data.registrationsCount, 0, 'archived excluded');
      void e3;
    });

    await test('club head and admin counts reflect their own scope and update after edits', async () => {
      const before = (await api('GET', `/profiles/${head.id}/stats`, { token: head.token })).data;
      eq(before.role, 'CLUB_HEAD', 'role');
      const direct = await prisma.event.count({ where: { clubId: gdg.id, isArchived: false } });
      eq(before.eventsCount, direct, 'matches the database for the club');
      const ev = await newEvent();
      eq((await api('GET', `/profiles/${head.id}/stats`, { token: head.token })).data.eventsCount, direct + 1, 'create increments');
      await api('POST', `/events/${ev.id}/unpublish`, { token: head.token });
      const afterUnpublish = (await api('GET', `/profiles/${head.id}/stats`, { token: head.token })).data;
      eq(afterUnpublish.eventsCount, direct + 1, 'unpublished still managed');
      eq(afterUnpublish.publishedEventsCount, before.publishedEventsCount, 'published count excludes it');
      const adminStats = (await api('GET', `/profiles/${admin.id}/stats`, { token: admin.token })).data;
      eq(adminStats.role, 'SUPER_ADMIN', 'admin role');
      eq(adminStats.events.total, await prisma.event.count({ where: { isArchived: false } }), 'platform events');
      // Club dashboard uses the same service.
      const dash = (await api('GET', `/clubs/${gdg.id}/dashboard-stats`, { token: head.token })).data;
      eq(dash.totalEvents, direct + 1, 'dashboard total agrees with profile stats');
    });

    // ── Pagination & search ──────────────────────────────────────────────────
    await test('pagination: totals, page contents, ordering and size limits follow the filtered dataset', async () => {
      const prefix = `PG-${tag}`;
      await prisma.event.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          clubId: gdg.id,
          name: `${prefix}-${String(i).padStart(2, '0')}`,
          description: 'pagination fixture',
          eventType: 'Solo',
          registrationLimit: 10,
          eventDate: new Date(Date.now() + (i + 1) * 3_600_000 + 7 * 864e5),
        })),
      });
      const q = encodeURIComponent(prefix);
      const p1 = await api('GET', `/events?search=${q}&page=1&pageSize=10`);
      const p2 = await api('GET', `/events?search=${q}&page=2&pageSize=10`);
      const p3 = await api('GET', `/events?search=${q}&page=3&pageSize=10`);
      const p4 = await api('GET', `/events?search=${q}&page=4&pageSize=10`);
      eq(p1.data.pagination, { page: 1, pageSize: 10, totalItems: 25, totalPages: 3 }, 'page 1 meta');
      eq([p1, p2, p3, p4].map(p => p.data.items.length), [10, 10, 5, 0], 'items per page');
      const names = [...p1.data.items, ...p2.data.items, ...p3.data.items].map((e: any) => e.name);
      eq(new Set(names).size, 25, 'no duplicates across pages');
      eq(names, [...names].sort(), 'deterministic ascending order by date');
      eq((await api('GET', `/events?search=${q}&pageSize=1000`)).data.pagination.pageSize, 100, 'page size clamped');
      eq((await api('GET', `/events?search=${q}&page=-3&pageSize=abc`)).data.pagination.page, 1, 'invalid params normalised');
      await prisma.event.deleteMany({ where: { name: { startsWith: prefix } } });
    });

    await test('search finds a record that lives on a later page, and filters apply before counting', async () => {
      const needle = `NEEDLE-${tag}`;
      await prisma.event.create({ data: { clubId: gdg.id, name: needle, description: '', eventType: 'Solo', registrationLimit: 5, eventDate: futureDate(900) } });
      const all = await api('GET', '/events?pageSize=10&page=1');
      check(!all.data.items.some((e: any) => e.name === needle) || all.data.pagination.totalPages === 1, 'needle is not on page 1 of the unfiltered list');
      const found = await api('GET', `/events?search=${needle.toLowerCase()}`);
      eq(found.data.pagination.totalItems, 1, 'search total');
      eq(found.data.items[0].name, needle, 'found');
      const past = await api('GET', `/events?status=past&pageSize=100`);
      check(past.data.items.every((e: any) => new Date(e.eventEndDate ?? e.eventDate) < new Date()), 'past filter');
      await prisma.event.deleteMany({ where: { name: needle } });
    });

    await test('managed registrations list paginates, filters by status and searches across pages', async () => {
      const ev = await newEvent({ registrationLimit: 100 });
      const us = await Promise.all(Array.from({ length: 12 }, (_, i) => student(`reg${i}`)));
      await Promise.all(us.map(u => api('POST', '/register', { token: u.token, body: { eventId: ev.id } })));
      const p = await api('GET', `/events/${ev.id}/registrations?page=2&pageSize=5`, { token: head.token });
      eq(p.data.pagination.totalItems, 12, 'total');
      eq(p.data.items.length, 5, 'page 2 size');
      const one = await api('GET', `/events/${ev.id}/registrations?page=1&pageSize=5&search=${encodeURIComponent(us[11].email)}`, { token: head.token });
      eq(one.data.pagination.totalItems, 1, 'search across pages');
      eq((await api('GET', `/events/${ev.id}/registrations?page=1`, { token: otherHead.token })).status, 403, 'other club');
    });
  } finally {
    await prisma.event.deleteMany({ where: { id: { in: created } } }).catch(() => {});
    await prisma.profile.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await srv.close();
    summary();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
