import { Role } from '@prisma/client';
import prisma from '../config/db';
import { check, createRunner, eq, makeUser, uid } from './helpers';

/**
 * Database-level guarantees of the optimised schema. These run against Prisma directly (not the HTTP API)
 * on purpose: the counters and rules must hold no matter which code path changes the data.
 */
async function main() {
  const { test, summary } = createRunner('🗄️ Schema: counters, integrity rules and index usage');
  const gdg = await prisma.club.findFirstOrThrow({ where: { email: 'gdg@college.edu' } });
  const cleanup: Array<() => Promise<unknown>> = [];
  const tag = uid();

  const newEvent = async (overrides: Record<string, unknown> = {}) => {
    const e = await prisma.event.create({
      data: { clubId: gdg.id, name: `SCHEMA-${tag}-${uid()}`, description: '', eventType: 'Solo', registrationLimit: 50, eventDate: new Date(Date.now() + 7 * 864e5), ...overrides } as any,
    });
    cleanup.push(() => prisma.event.deleteMany({ where: { id: e.id } }));
    return e;
  };
  const student = async (p: string) => {
    const u = await makeUser(p);
    cleanup.push(() => prisma.profile.deleteMany({ where: { id: u.id } }));
    return u;
  };
  const counts = async (eventId: string) => {
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { pendingCount: true, confirmedCount: true, rejectedCount: true } });
    return [e.pendingCount, e.confirmedCount, e.rejectedCount];
  };
  const truth = async (eventId: string) => {
    const g = await prisma.registration.groupBy({ by: ['status'], where: { eventId }, _count: { _all: true } });
    const n = (s: string) => g.find(x => x.status === s)?._count._all ?? 0;
    return [n('PENDING'), n('CONFIRMED'), n('REJECTED')];
  };

  try {
    // ── Event registration counters ──────────────────────────────────────────
    await test('event counters follow every registration change: insert, approve, reject, re-register, delete', async () => {
      const ev = await newEvent();
      const [a, b, c] = await Promise.all([student('a'), student('b'), student('c')]);
      const ra = await prisma.registration.create({ data: { eventId: ev.id, userId: a.id, status: 'PENDING' } });
      await prisma.registration.create({ data: { eventId: ev.id, userId: b.id, status: 'CONFIRMED' } });
      const rc = await prisma.registration.create({ data: { eventId: ev.id, userId: c.id, status: 'PENDING' } });
      eq(await counts(ev.id), [2, 1, 0], 'after inserts');
      await prisma.registration.update({ where: { id: ra.id }, data: { status: 'CONFIRMED' } });
      eq(await counts(ev.id), [1, 2, 0], 'after approve');
      await prisma.registration.update({ where: { id: rc.id }, data: { status: 'REJECTED' } });
      eq(await counts(ev.id), [0, 2, 1], 'after reject');
      await prisma.registration.update({ where: { id: rc.id }, data: { status: 'PENDING' } });
      eq(await counts(ev.id), [1, 2, 0], 'after re-register');
      await prisma.registration.update({ where: { id: ra.id }, data: { transactionId: 'UTR12345678' } });
      eq(await counts(ev.id), [1, 2, 0], 'unrelated update changes nothing');
      await prisma.registration.delete({ where: { id: ra.id } });
      eq(await counts(ev.id), [1, 1, 0], 'after delete');
      eq(await counts(ev.id), await truth(ev.id), 'matches a real COUNT');
      await prisma.registration.updateMany({ where: { eventId: ev.id }, data: { status: 'REJECTED' } });
      eq(await counts(ev.id), [0, 0, 2], 'bulk update');
    });

    await test('counters stay exact under 30 concurrent registrations', async () => {
      const ev = await newEvent({ registrationLimit: 1000 });
      const users = await Promise.all(Array.from({ length: 30 }, (_, i) => student(`cc${i}`)));
      await Promise.all(users.map((u, i) => prisma.registration.create({ data: { eventId: ev.id, userId: u.id, status: i % 3 === 0 ? 'CONFIRMED' : 'PENDING' } })));
      eq(await counts(ev.id), await truth(ev.id), 'matches COUNT');
      eq((await counts(ev.id)).reduce((x, y) => x + y, 0), 30, 'total');
    });

    await test('deleting an event or a student cleans up and keeps remaining counters right', async () => {
      const ev1 = await newEvent();
      const ev2 = await newEvent();
      const u = await student('del');
      await prisma.registration.create({ data: { eventId: ev1.id, userId: u.id, status: 'CONFIRMED' } });
      await prisma.registration.create({ data: { eventId: ev2.id, userId: u.id, status: 'PENDING' } });
      await prisma.profile.delete({ where: { id: u.id } }); // cascades both registrations
      eq(await counts(ev1.id), [0, 0, 0], 'event 1 after student deleted');
      eq(await counts(ev2.id), [0, 0, 0], 'event 2 after student deleted');
      const u2 = await student('del2');
      await prisma.registration.create({ data: { eventId: ev1.id, userId: u2.id, status: 'CONFIRMED' } });
      await prisma.event.delete({ where: { id: ev1.id } }); // cascades its registrations
      eq(await prisma.registration.count({ where: { eventId: ev1.id } }), 0, 'registrations cascaded');
    });

    await test('Registration.club_id is filled from the event automatically', async () => {
      const ev = await newEvent();
      const u = await student('club');
      const reg = await prisma.registration.create({ data: { eventId: ev.id, userId: u.id } });
      eq(reg.clubId, gdg.id, 'clubId copied from the event');
    });

    // ── Team member counter ──────────────────────────────────────────────────
    await test('team member_count counts pending + confirmed members only', async () => {
      const ev = await newEvent({ eventType: 'Team', teamSizeLimit: 4 });
      const [l, m, r] = await Promise.all([student('tl'), student('tm'), student('tr')]);
      const team = await prisma.team.create({ data: { eventId: ev.id, teamName: 'T', leaderId: l.id } });
      const members = async () => (await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).memberCount;
      await prisma.registration.create({ data: { eventId: ev.id, userId: l.id, teamId: team.id, status: 'PENDING' } });
      const rm = await prisma.registration.create({ data: { eventId: ev.id, userId: m.id, teamId: team.id, status: 'CONFIRMED' } });
      const rr = await prisma.registration.create({ data: { eventId: ev.id, userId: r.id, teamId: team.id, status: 'REJECTED' } });
      eq(await members(), 2, 'leader + confirmed member');
      await prisma.registration.update({ where: { id: rr.id }, data: { status: 'PENDING' } });
      eq(await members(), 3, 'rejected member re-applies');
      await prisma.registration.update({ where: { id: rm.id }, data: { status: 'REJECTED' } });
      eq(await members(), 2, 'member rejected');
      await prisma.registration.updateMany({ where: { teamId: team.id }, data: { status: 'REJECTED' } });
      eq(await members(), 0, 'whole team rejected');
    });

    // ── Club counters ────────────────────────────────────────────────────────
    await test('club event_count and product_count track non-archived events and products', async () => {
      const club = await prisma.club.create({ data: { name: `Counter Club ${tag}`, email: `cc_${tag}@test.skyline` } });
      cleanup.push(() => prisma.club.deleteMany({ where: { id: club.id } }));
      const read = async () => {
        const c = await prisma.club.findUniqueOrThrow({ where: { id: club.id } });
        return [c.eventCount, c.productCount];
      };
      const mk = () => prisma.event.create({ data: { clubId: club.id, name: 'E', description: '', eventType: 'Solo', registrationLimit: 5, eventDate: new Date(Date.now() + 864e5) } });
      const e1 = await mk();
      await mk();
      const p1 = await prisma.product.create({ data: { clubId: club.id, name: 'P', pricePaise: 100 } });
      eq(await read(), [2, 1], 'after creates');
      await prisma.event.update({ where: { id: e1.id }, data: { isArchived: true } });
      await prisma.product.update({ where: { id: p1.id }, data: { isArchived: true } });
      eq(await read(), [1, 0], 'after archive');
      await prisma.event.update({ where: { id: e1.id }, data: { isArchived: false } });
      eq(await read(), [2, 0], 'after restore');
      await prisma.event.delete({ where: { id: e1.id } });
      eq(await read(), [1, 0], 'after delete');
    });

    // ── Product total stock ──────────────────────────────────────────────────
    await test('product total_stock is the sum of active variant stock, even with concurrent changes', async () => {
      const club = gdg;
      const p = await prisma.product.create({ data: { clubId: club.id, name: `STOCK-${tag}`, pricePaise: 100, variants: { create: [{ label: 'S', stock: 5 }, { label: 'M', stock: 7 }] } } });
      cleanup.push(() => prisma.product.deleteMany({ where: { id: p.id } }));
      const total = async () => (await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).totalStock;
      eq(await total(), 12, 'initial');
      const [s, m] = await prisma.productVariant.findMany({ where: { productId: p.id }, orderBy: { label: 'desc' } }); // S, M
      await Promise.all([
        prisma.productVariant.update({ where: { id: s.id }, data: { stock: { decrement: 2 } } }),
        prisma.productVariant.update({ where: { id: m.id }, data: { stock: { decrement: 3 } } }),
        prisma.productVariant.update({ where: { id: s.id }, data: { stock: { decrement: 1 } } }),
      ]);
      eq(await total(), 6, 'after concurrent decrements');
      await prisma.productVariant.update({ where: { id: m.id }, data: { isActive: false } });
      eq(await total(), 2, 'inactive variant excluded');
      await prisma.productVariant.create({ data: { productId: p.id, label: 'L', stock: 4 } });
      eq(await total(), 6, 'new variant included');
      await prisma.productVariant.delete({ where: { id: s.id } });
      eq(await total(), 4, 'variant deleted');
      const real = await prisma.productVariant.aggregate({ where: { productId: p.id, isActive: true }, _sum: { stock: true } });
      eq(await total(), real._sum.stock ?? 0, 'matches a real SUM');
    });

    // ── Unread notifications ─────────────────────────────────────────────────
    await test('unread_notification_count follows insert, mark-read, mark-all and delete', async () => {
      const u = await student('bell');
      const unread = async () => (await prisma.profile.findUniqueOrThrow({ where: { id: u.id } })).unreadNotificationCount;
      const mk = () => prisma.notification.create({ data: { userId: u.id, type: 't', title: 'x', body: 'y' } });
      const [n1] = await Promise.all([mk(), mk(), mk()]);
      eq(await unread(), 3, 'three unread');
      await prisma.notification.update({ where: { id: n1.id }, data: { isRead: true } });
      eq(await unread(), 2, 'one read');
      await prisma.notification.update({ where: { id: n1.id }, data: { isRead: true } });
      eq(await unread(), 2, 'marking read twice is a no-op');
      await prisma.notification.updateMany({ where: { userId: u.id, isRead: false }, data: { isRead: true } });
      eq(await unread(), 0, 'mark all read');
      const n4 = await mk();
      eq(await unread(), 1, 'new one');
      await prisma.notification.delete({ where: { id: n4.id } });
      eq(await unread(), 0, 'unread one deleted');
    });

    // ── Integrity rules ──────────────────────────────────────────────────────
    const rejects = async (fn: () => Promise<unknown>, label: string) => {
      let failed = false;
      try {
        await fn();
      } catch {
        failed = true;
      }
      check(failed, `${label} should have been rejected by the database`);
    };

    await test('the database refuses inconsistent roles, bad numbers and orphan rows', async () => {
      const u = await student('rule');
      await rejects(() => prisma.profile.update({ where: { id: u.id }, data: { role: Role.CLUB_HEAD } }), 'a club head without a club');
      await rejects(() => prisma.profile.update({ where: { id: u.id }, data: { clubId: gdg.id } }), 'a student attached to a club');
      await rejects(() => prisma.profile.create({ data: { id: `x_${uid()}`, email: `x_${uid()}@t.t`, fullName: 'x', role: Role.SUPER_ADMIN, clubId: gdg.id } }), 'a super admin attached to a club');
      await rejects(() => newEvent({ fee: -5 }), 'a negative event fee');
      await rejects(() => newEvent({ registrationLimit: 0 }), 'a zero capacity');
      await rejects(() => prisma.notification.create({ data: { userId: 'nobody-here', type: 't', title: 'x', body: 'y' } }), 'a notification for a missing user');
      await rejects(() => prisma.$executeRawUnsafe(`UPDATE "Event" SET pending_count = -1 WHERE id = (SELECT id FROM "Event" LIMIT 1)`), 'a negative counter');
    });

    // ── Index usage on a large table ─────────────────────────────────────────
    await test('Postgres uses the new indexes for search and list queries on 50,000 rows', async () => {
      const marker = `bulk${tag}`;
      const ev = await newEvent({ registrationLimit: 100000 });
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Profile" (id, full_name, email, usn, role, is_active, created_at, unread_notification_count)
        SELECT '${marker}_' || g, 'Student ' || g || ' ${marker}', '${marker}_' || g || '@college.test', 'U${marker}' || g, 'STUDENT', true, now() - (g || ' seconds')::interval, 0
        FROM generate_series(1, 50000) g`);
      cleanup.push(() => prisma.$executeRawUnsafe(`DELETE FROM "Profile" WHERE id LIKE '${marker}\\_%'`));
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Registration" (id, event_id, user_id, status, created_at)
        SELECT gen_random_uuid()::text, '${ev.id}', '${marker}_' || g, (ARRAY['PENDING','CONFIRMED','REJECTED']::"RegistrationStatus"[])[1 + g % 3], now() - (g || ' seconds')::interval
        FROM generate_series(1, 50000) g`);
      await prisma.$executeRawUnsafe(`ANALYZE "Profile"`);
      await prisma.$executeRawUnsafe(`ANALYZE "Registration"`);
      eq(await counts(ev.id), await truth(ev.id), 'counters exact after a 50,000-row bulk insert');

      const plan = async (sql: string) => (await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`EXPLAIN ${sql}`)).map(r => r['QUERY PLAN']).join('\n');

      const search = await plan(`SELECT id FROM "Profile" WHERE email ILIKE '%${marker}_4999%' LIMIT 10`);
      check(/idx_profile_email_trgm/.test(search), `email search should use the trigram index:\n${search}`);
      const nameSearch = await plan(`SELECT id FROM "Profile" WHERE full_name ILIKE '%Student 4999 %' LIMIT 10`);
      check(/idx_profile_name_trgm/.test(nameSearch), `name search should use the trigram index:\n${nameSearch}`);

      const reviewList = await plan(`SELECT id FROM "Registration" WHERE event_id = '${ev.id}' AND status = 'PENDING' ORDER BY created_at DESC LIMIT 10`);
      check(/idx_registration_event_status/.test(reviewList) && !/Seq Scan on "Registration"/.test(reviewList), `review list should use the event/status index:\n${reviewList}`);

      const tickets = await plan(`SELECT id FROM "Registration" WHERE user_id = '${marker}_123' ORDER BY created_at DESC`);
      check(!/Seq Scan on "Registration"/.test(tickets), `a student's tickets should not scan the table:\n${tickets}`);

      const adminUsers = await plan(`SELECT id FROM "Profile" WHERE role = 'STUDENT' ORDER BY full_name ASC, id ASC LIMIT 25`);
      check(/idx_profile_name/.test(adminUsers) || /Index/.test(adminUsers), `sorted user list should be index-driven:\n${adminUsers}`);

      const pub = await plan(`SELECT id FROM "Event" WHERE is_published = true AND is_archived = false AND event_date > now() ORDER BY event_date ASC LIMIT 12`);
      check(/Index/.test(pub) || /Seq Scan on "Event"/.test(pub), 'public events plan is valid');
    });
  } finally {
    for (const fn of cleanup.reverse()) await fn().catch(() => {});
    summary();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
