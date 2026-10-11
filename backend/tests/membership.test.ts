process.env.MAIL_TRANSPORT = 'memory';
process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // never touch real storage from tests
import { Role } from '@prisma/client';
import prisma from '../config/db';
import app from '../index';
import { check, createRunner, eq, eventBody, makeUser, seeded, startServer, uid } from './helpers';

/**
 * Memberships and member pricing, volunteer tasks, announcements and the dues → ledger link.
 * Uses its own club so its (append-only) ledger entries never mix with other suites' figures.
 */
async function main() {
  const srv = await startServer(app);
  const { test, summary } = createRunner('🎟️ Membership, member pricing, tasks, announcements');
  const { api } = srv;
  const tag = uid();
  const users: string[] = [];
  const events: string[] = [];
  const products: string[] = [];

  const otherHead = await seeded('ieee.head@college.edu');
  const club = await prisma.club.create({
    data: { name: `Members Club ${tag}`, email: `mc_${tag}@test.skyline`, upiId: 'club@upi', membershipFeePaise: 20000, membershipMonths: 12 },
  });
  const head = await makeUser('mhead', Role.CLUB_HEAD, club.id);
  users.push(head.id);
  const student = async (p: string) => {
    const u = await makeUser(p);
    users.push(u.id);
    return u;
  };
  const sMember = await student('member');
  const sGuest = await student('guest');
  const sReject = await student('reject');

  const join = (u: { token: string }, txn: string, clubId = club.id) => api('POST', `/memberships/club/${clubId}/join`, { token: u.token, body: { transactionId: txn } });
  const mkEvent = async (overrides: Record<string, unknown> = {}) => {
    const r = await api('POST', '/events', { token: head.token, body: eventBody({ name: `MEM-${tag}-${uid()}`, ...overrides }) });
    check(r.status === 201, `event create failed: ${r.status} ${r.text}`);
    events.push(r.data.event.id);
    return r.data.event as any;
  };
  const duesEntries = () => prisma.ledgerEntry.findMany({ where: { clubId: club.id, category: 'DUES' } });
  let memberRowId = '';

  try {
    // ── Joining and verification ─────────────────────────────────────────────
    await test('anyone can see a club\'s membership offer; a new student is not a member', async () => {
      const anon = await api('GET', `/memberships/club/${club.id}`);
      eq(anon.status, 200, 'status');
      eq(anon.data.club.membershipFeePaise, 20000, 'dues');
      eq(anon.data.club.membershipMonths, 12, 'months');
      eq(anon.data.membership, null, 'anonymous has no standing');
      eq((await api('GET', `/memberships/club/${club.id}`, { token: sMember.token })).data.membership.state, 'NONE', 'student state');
    });

    await test('joining needs a login, a valid reference, and only one payment can wait for review', async () => {
      eq((await api('POST', `/memberships/club/${club.id}/join`, { body: { transactionId: 'ABC123456' } })).status, 401, 'anonymous');
      eq((await join(sMember, '')).status, 400, 'missing reference');
      eq((await join(sMember, 'x y!')).status, 400, 'bad reference');
      eq((await join(head, 'HEAD123456')).status, 403, 'club heads cannot join as students');
      const ok = await join(sMember, `MEM${tag}1`);
      eq(ok.status, 201, 'submitted');
      eq(ok.data.membership.status, 'PENDING', 'pending');
      eq(ok.data.membership.duesPaidPaise, 20000, 'dues snapshot');
      memberRowId = ok.data.membership.id;
      eq((await join(sMember, `MEM${tag}2`)).status, 409, 'second pending');
      eq((await join(sGuest, `MEM${tag}1`)).status, 409, 'reference reuse');
      const mine = await api('GET', '/memberships/mine', { token: sMember.token });
      eq(mine.data.memberships[0].pendingPayment.id, memberRowId, 'student sees pending');
      eq(mine.data.memberships[0].isMember, false, 'not yet a member');
    });

    await test('only the club\'s own head sees and verifies applications', async () => {
      const list = await api('GET', '/memberships/manage?state=pending', { token: head.token });
      eq(list.status, 200, 'list');
      check(list.data.items.some((m: any) => m.id === memberRowId), 'application listed');
      const foreign = await api('GET', `/memberships/manage?clubId=${club.id}`, { token: otherHead.token });
      eq(foreign.status, 403, 'foreign club list');
      eq((await api('POST', `/memberships/manage/${memberRowId}/verify`, { token: otherHead.token })).status, 403, 'foreign verify');
      eq((await api('POST', `/memberships/manage/${memberRowId}/verify`, { token: sGuest.token })).status, 403, 'student verify');
      eq((await api('POST', `/memberships/manage/${memberRowId}/verify`)).status, 401, 'anonymous verify');
    });

    await test('verifying activates the membership for the club period and records the dues in the ledger once', async () => {
      eq((await duesEntries()).length, 0, 'no dues yet');
      const v = await api('POST', `/memberships/manage/${memberRowId}/verify`, { token: head.token });
      eq(v.status, 200, 'verify');
      eq(v.data.membership.status, 'ACTIVE', 'active');
      const months = (new Date(v.data.membership.endDate).getTime() - new Date(v.data.membership.startDate).getTime()) / 86400000;
      check(months >= 364 && months <= 366, `about a year, got ${months} days`);
      const dues = await duesEntries();
      eq(dues.length, 1, 'one ledger entry');
      eq([dues[0].type, dues[0].amountPaise, dues[0].refType], ['IN', 20000, 'membership'], 'ledger entry');
      const again = await api('POST', `/memberships/manage/${memberRowId}/verify`, { token: head.token });
      eq(again.status, 200, 'second verify');
      eq(again.data.duplicate, true, 'flagged duplicate');
      eq((await duesEntries()).length, 1, 'still one ledger entry');
      check(await prisma.notification.findFirst({ where: { userId: sMember.id, type: 'membership_approved' } }), 'student notified');
      eq((await api('GET', '/memberships/mine', { token: sMember.token })).data.memberships[0].isMember, true, 'now a member');
    });

    await test('concurrent verifications create exactly one ledger entry', async () => {
      const u = await student('race');
      const row = (await join(u, `RACE${tag}`)).data.membership;
      const results = await Promise.all([1, 2, 3, 4].map(() => api('POST', `/memberships/manage/${row.id}/verify`, { token: head.token })));
      check(results.every(r => r.status === 200), `all succeed: ${results.map(r => r.status)}`);
      eq((await duesEntries()).filter(e => e.refId === row.id).length, 1, 'one entry for this membership');
    });

    await test('a rejected payment notifies the student and can be resubmitted with a new reference', async () => {
      const row = (await join(sReject, `REJ${tag}1`)).data.membership;
      eq((await api('POST', `/memberships/manage/${row.id}/reject`, { token: head.token, body: { reason: 'Amount mismatch' } })).status, 200, 'reject');
      const note = await prisma.notification.findFirst({ where: { userId: sReject.id, type: 'membership_rejected' } });
      check(note && note.body.includes('Amount mismatch'), 'student told why');
      eq((await duesEntries()).filter(e => e.refId === row.id).length, 0, 'nothing in the ledger');
      eq((await api('POST', `/memberships/manage/${row.id}/verify`, { token: head.token })).status, 409, 'rejected cannot be verified');
      eq((await join(sReject, `REJ${tag}2`)).status, 201, 'resubmitted');
    });

    // ── Member pricing: events ───────────────────────────────────────────────
    await test('events can have a member fee, never above the normal fee', async () => {
      eq((await api('POST', '/events', { token: head.token, body: eventBody({ fee: 100, memberFee: 150 }) })).status, 400, 'member fee above fee');
      eq((await api('POST', '/events', { token: head.token, body: eventBody({ fee: 100, memberFee: -1 }) })).status, 400, 'negative');
      const ev = await mkEvent({ fee: 100, memberFee: 40 });
      eq(ev.memberFee, 40, 'stored');
      const upd = await api('PUT', `/events/${ev.id}`, { token: head.token, body: { memberFee: null } });
      eq(upd.status, 200, 'cleared');
      eq(upd.data.event.memberFee, null, 'null means members pay the normal fee');
      eq((await api('PUT', `/events/${ev.id}`, { token: head.token, body: { fee: 30, memberFee: 40 } })).status, 400, 'lowering fee below member fee');
    });

    let paid: any;
    await test('members are charged the member price; everyone else the normal fee, fixed at registration', async () => {
      paid = await mkEvent({ fee: 100, memberFee: 40 });
      const anon = await api('GET', `/events/${paid.id}`);
      eq([anon.data.event.fee, anon.data.event.memberFee, anon.data.event.isMember, anon.data.event.yourFee], [100, 40, false, 100], 'anonymous view');
      const asMember = await api('GET', `/events/${paid.id}`, { token: sMember.token });
      eq([asMember.data.event.isMember, asMember.data.event.yourFee], [true, 40], 'member view');
      const list = await api('GET', `/events?search=${paid.name}`, { token: sMember.token });
      eq(list.data.events.find((e: any) => e.id === paid.id).yourFee, 40, 'member price in the list');

      const m = await api('POST', '/register', { token: sMember.token, body: { eventId: paid.id } });
      eq(m.status, 201, 'member registers');
      eq([m.data.feeCharged ?? m.data.registration?.feeCharged, m.data.isMemberPrice ?? m.data.registration?.isMemberPrice], [40, true], 'member charged');
      const g = await api('POST', '/register', { token: sGuest.token, body: { eventId: paid.id } });
      eq(g.status, 201, 'guest registers');
      eq(g.data.feeCharged ?? g.data.registration?.feeCharged, 100, 'guest charged');

      // the price stays fixed even if the membership later changes or the club edits the member fee
      await api('PUT', `/events/${paid.id}`, { token: head.token, body: { memberFee: 10 } });
      const row = await prisma.registration.findFirstOrThrow({ where: { eventId: paid.id, userId: sMember.id } });
      eq(row.feeCharged, 40, 'unchanged after the fee edit');
      await api('PUT', `/events/${paid.id}`, { token: head.token, body: { memberFee: 40 } });
    });

    await test('a free member price confirms the member instantly while guests still pay', async () => {
      const ev = await mkEvent({ fee: 50, memberFee: 0 });
      const m = await api('POST', '/register', { token: sMember.token, body: { eventId: ev.id } });
      const reg = await prisma.registration.findFirstOrThrow({ where: { eventId: ev.id, userId: sMember.id } });
      eq([m.status, reg.status, reg.feeCharged], [201, 'CONFIRMED', 0], 'member free + confirmed');
      eq((await api('PUT', `/registrations/${reg.id}/payment`, { token: sMember.token, body: { transactionId: `FREE${tag}1` } })).status, 400, 'no payment needed');
      await api('POST', '/register', { token: sGuest.token, body: { eventId: ev.id } });
      const g = await prisma.registration.findFirstOrThrow({ where: { eventId: ev.id, userId: sGuest.id } });
      eq([g.status, g.feeCharged], ['PENDING', 50], 'guest pays');
    });

    await test('ticket income in the ledger uses the price each student actually paid', async () => {
      const mReg = await prisma.registration.findFirstOrThrow({ where: { eventId: paid.id, userId: sMember.id } });
      const gReg = await prisma.registration.findFirstOrThrow({ where: { eventId: paid.id, userId: sGuest.id } });
      eq((await api('PUT', `/registrations/${mReg.id}/payment`, { token: sMember.token, body: { transactionId: `TKM${tag}` } })).status, 200, 'member pays');
      eq((await api('PUT', `/registrations/${gReg.id}/payment`, { token: sGuest.token, body: { transactionId: `TKG${tag}` } })).status, 200, 'guest pays');
      eq((await api('PUT', `/registrations/${mReg.id}/approve`, { token: head.token })).status, 200, 'approve member');
      eq((await api('PUT', `/registrations/${gReg.id}/approve`, { token: head.token })).status, 200, 'approve guest');
      const tickets = await prisma.ledgerEntry.findMany({ where: { clubId: club.id, category: 'TICKET', eventId: paid.id }, orderBy: { amountPaise: 'asc' } });
      eq(tickets.map(t => t.amountPaise), [4000, 10000], 'member 40.00 and guest 100.00');
    });

    await test('the door scanner shows a member or guest badge', async () => {
      const mReg = await prisma.registration.findFirstOrThrow({ where: { eventId: paid.id, userId: sMember.id } });
      const gReg = await prisma.registration.findFirstOrThrow({ where: { eventId: paid.id, userId: sGuest.id } });
      const m = await api('POST', '/registrations/verify-ticket', { token: head.token, body: { ticketId: mReg.id, eventId: paid.id } });
      eq([m.status, m.data.memberBadge, m.data.isMember, m.data.ticket.attendee.isMember], [200, '[ACTIVE CLUB MEMBER]', true, true], 'member');
      const g = await api('POST', '/registrations/verify-ticket', { token: head.token, body: { ticketId: gReg.id, eventId: paid.id } });
      eq([g.status, g.data.memberBadge, g.data.isMember], [200, '[GUEST / NON-MEMBER]', false], 'guest');
      const again = await api('POST', '/registrations/verify-ticket', { token: head.token, body: { ticketId: mReg.id, eventId: paid.id } });
      eq([again.data.alreadyCheckedIn, again.data.memberBadge], [true, '[ACTIVE CLUB MEMBER]'], 'repeat scan keeps the badge');
    });

    // ── Expiry, reminders and renewal ────────────────────────────────────────
    await test('an expiring membership shows a renewal state and sends one reminder', async () => {
      await prisma.membership.update({ where: { id: memberRowId }, data: { endDate: new Date(Date.now() + 3 * 86400000) } });
      const a = await api('GET', '/memberships/mine', { token: sMember.token });
      const me = a.data.memberships.find((m: any) => m.club.id === club.id);
      eq([me.state, me.isMember], ['EXPIRING', true], 'expiring but still a member');
      await api('GET', '/memberships/mine', { token: sMember.token });
      eq(await prisma.notification.count({ where: { userId: sMember.id, type: 'membership_expiring' } }), 1, 'one reminder only');
      eq((await join(sMember, `REN${tag}0`)).status, 201, 'renewal allowed inside the window');
      await prisma.membership.deleteMany({ where: { userId: sMember.id, status: 'PENDING' } });
    });

    await test('an expired membership loses member prices, and renewing restores them', async () => {
      await prisma.membership.update({ where: { id: memberRowId }, data: { endDate: new Date(Date.now() - 86400000), startDate: new Date(Date.now() - 366 * 86400000) } });
      const mine = await api('GET', '/memberships/mine', { token: sMember.token });
      eq([mine.data.memberships[0].state, mine.data.memberships[0].isMember], ['EXPIRED', false], 'expired');
      const ev = await mkEvent({ fee: 100, memberFee: 40 });
      eq((await api('GET', `/events/${ev.id}`, { token: sMember.token })).data.event.yourFee, 100, 'full price again');
      const renewal = await join(sMember, `REN${tag}1`);
      eq(renewal.status, 201, 'renew');
      eq((await api('POST', `/memberships/manage/${renewal.data.membership.id}/verify`, { token: head.token })).status, 200, 'verified');
      eq((await api('GET', `/events/${ev.id}`, { token: sMember.token })).data.event.yourFee, 40, 'member price restored');
      eq((await duesEntries()).filter(e => e.amountPaise === 20000).length >= 3, true, 'each dues payment is its own ledger entry');
    });

    await test('renewing early starts the new period when the current one ends', async () => {
      const u = await student('early');
      const first = (await join(u, `ERL${tag}1`)).data.membership;
      await api('POST', `/memberships/manage/${first.id}/verify`, { token: head.token });
      const current = await prisma.membership.findUniqueOrThrow({ where: { id: first.id } });
      eq((await join(u, `ERL${tag}2`)).status, 409, 'too early to renew');
      await prisma.membership.update({ where: { id: first.id }, data: { endDate: new Date(Date.now() + 2 * 86400000) } });
      const second = (await join(u, `ERL${tag}3`)).data.membership;
      const v = await api('POST', `/memberships/manage/${second.id}/verify`, { token: head.token });
      const started = new Date(v.data.membership.startDate).getTime();
      const prevEnd = Date.now() + 2 * 86400000;
      check(Math.abs(started - prevEnd) < 60_000, 'new period starts when the old one ends');
      check(current.endDate, 'first had an end');
    });

    await test('settings: only valid dues can be set, by the club\'s head', async () => {
      eq((await api('PUT', '/memberships/manage/settings', { token: head.token, body: { membershipFeePaise: -5 } })).status, 400, 'negative dues');
      eq((await api('PUT', '/memberships/manage/settings', { token: head.token, body: { membershipMonths: 0 } })).status, 400, 'zero months');
      eq((await api('PUT', '/memberships/manage/settings', { token: sGuest.token, body: { membershipFeePaise: 1 } })).status, 403, 'student');
      eq((await api('PUT', '/memberships/manage/settings', { token: otherHead.token, body: { clubId: club.id, membershipFeePaise: 1 } })).status, 403, 'foreign head');
      const free = await prisma.club.create({ data: { name: `Free Club ${tag}`, email: `fc_${tag}@test.skyline`, membershipFeePaise: 0, membershipMonths: 6 } });
      const u = await student('freejoin');
      const r = await api('POST', `/memberships/club/${free.id}/join`, { token: u.token, body: {} });
      eq([r.status, r.data.membership.status], [201, 'ACTIVE'], 'free membership is instant');
      await prisma.club.delete({ where: { id: free.id } });
    });

    // ── Member pricing: merchandise ──────────────────────────────────────────
    await test('merch member discounts apply at checkout and are decided by the server', async () => {
      eq((await api('POST', '/merchandise/manage/products', { token: head.token, body: { name: 'x', pricePaise: 100, memberDiscountPercent: 101, variants: [{ label: 'M', stock: 1 }] } })).status, 400, 'over 100%');
      const p = await api('POST', '/merchandise/manage/products', {
        token: head.token,
        body: { name: `MERCH-${tag}`, pricePaise: 10000, memberDiscountPercent: 25, isPublished: true, variants: [{ label: 'M', stock: 10 }] },
      });
      eq(p.status, 201, 'product');
      products.push(p.data.product.id);
      const variantId = p.data.product.variants[0].id;
      eq(p.data.product.variants[0].memberPricePaise, 7500, 'member price shown');

      const asMember = await api('GET', `/merchandise/${p.data.product.id}`, { token: sMember.token });
      eq([asMember.data.product.isMember, asMember.data.product.variants[0].yourPricePaise], [true, 7500], 'member sees discount');
      eq((await api('GET', `/merchandise/${p.data.product.id}`)).data.product.variants[0].yourPricePaise, 10000, 'anonymous sees full price');

      const mo = await api('POST', '/merchandise/orders', { token: sMember.token, body: { productId: p.data.product.id, variantId, quantity: 2, unitPricePaise: 1 } });
      eq([mo.status, mo.data.order.unitPricePaise, mo.data.order.totalPaise, mo.data.order.isMemberPrice], [201, 7500, 15000, true], 'member order (client price ignored)');
      const go = await api('POST', '/merchandise/orders', { token: sGuest.token, body: { productId: p.data.product.id, variantId, quantity: 1 } });
      eq([go.status, go.data.order.unitPricePaise, go.data.order.isMemberPrice], [201, 10000, false], 'guest order');
    });

    // ── Volunteer tasks ──────────────────────────────────────────────────────
    let board: any;
    let task: any;
    await test('club heads create tasks for their events; only club members can be assigned', async () => {
      board = await mkEvent({ name: `BAKE-${tag}` });
      const empty = await api('GET', `/tasks/event/${board.id}`, { token: head.token });
      eq([empty.status, empty.data.progress.total, empty.data.progress.health], [200, 0, 'NO_TASKS'], 'empty board');
      eq((await api('POST', `/tasks/event/${board.id}`, { token: head.token, body: { title: '' } })).status, 400, 'title required');
      eq((await api('POST', `/tasks/event/${board.id}`, { token: head.token, body: { title: 'Buy flour', assignedToId: sGuest.id } })).status, 400, 'non-member');
      const t = await api('POST', `/tasks/event/${board.id}`, { token: head.token, body: { title: 'Bake cookies', description: '60 pieces', assignedToId: sMember.id, dueDate: new Date(Date.now() + 5 * 86400000).toISOString() } });
      eq(t.status, 201, 'created');
      task = t.data.task;
      eq(task.assignedTo.id, sMember.id, 'assigned');
      check(await prisma.notification.findFirst({ where: { userId: sMember.id, type: 'task_assigned' } }), 'volunteer notified');
      const second = await api('POST', `/tasks/event/${board.id}`, { token: head.token, body: { title: 'Run the cash table' } });
      eq(second.status, 201, 'unassigned task');
      const list = await api('GET', `/tasks/event/${board.id}`, { token: head.token });
      eq([list.data.progress.total, list.data.progress.done, list.data.board.TODO.length], [2, 0, 2], 'counters + columns');
      const assignees = await api('GET', `/tasks/event/${board.id}/assignees`, { token: head.token });
      check(assignees.data.assignees.some((a: any) => a.id === sMember.id) && !assignees.data.assignees.some((a: any) => a.id === sGuest.id), 'members only');
    });

    await test('only the club (or the assigned volunteer) can change a task; progress follows', async () => {
      eq((await api('GET', `/tasks/event/${board.id}`, { token: otherHead.token })).status, 403, 'foreign club board');
      eq((await api('POST', `/tasks/event/${board.id}`, { token: otherHead.token, body: { title: 'sneaky' } })).status, 403, 'foreign create');
      eq((await api('GET', `/tasks/event/${board.id}`, { token: sGuest.token })).status, 403, 'student board');
      eq((await api('PUT', `/tasks/${task.id}/status`, { token: sGuest.token, body: { status: 'DONE' } })).status, 403, 'someone else\'s task');
      eq((await api('PUT', `/tasks/${task.id}/status`, { token: sMember.token, body: { status: 'NOPE' } })).status, 400, 'bad status');
      eq((await api('PUT', `/tasks/${task.id}/status`, { token: sMember.token, body: { status: 'IN_PROGRESS' } })).status, 200, 'volunteer moves it');
      eq((await api('PUT', `/tasks/${task.id}/status`, { token: sMember.token, body: { status: 'DONE' } })).status, 200, 'volunteer finishes it');
      const mine = await api('GET', '/tasks/mine', { token: sMember.token });
      eq(mine.data.tasks.find((t: any) => t.id === task.id).status, 'DONE', 'shows in my tasks');
      const p = (await api('GET', `/tasks/event/${board.id}`, { token: head.token })).data.progress;
      eq([p.done, p.total, p.percent, p.summary], [1, 2, 50, '1/2 tasks complete – On Track'], 'progress');
      eq((await api('PUT', `/tasks/${task.id}`, { token: sMember.token, body: { title: 'renamed' } })).status, 403, 'volunteer cannot edit details');
      const del = await api('DELETE', `/tasks/${task.id}`, { token: head.token });
      eq(del.status, 200, 'delete');
      const after = (await api('GET', `/tasks/event/${board.id}`, { token: head.token })).data.progress;
      eq([after.done, after.total], [0, 1], 'counters after delete');
    });

    await test('overdue open tasks mark the board as behind schedule', async () => {
      const t = await api('POST', `/tasks/event/${board.id}`, { token: head.token, body: { title: 'Late one', dueDate: new Date(Date.now() - 86400000).toISOString() } });
      eq(t.status, 201, 'created');
      const p = (await api('GET', `/tasks/event/${board.id}`, { token: head.token })).data.progress;
      eq([p.health, p.overdueOpen], ['BEHIND', 1], 'behind');
    });

    // ── Announcements ────────────────────────────────────────────────────────
    await test('club heads post announcements; active members are notified in bulk; the timeline is public', async () => {
      eq((await api('POST', `/announcements/club/${club.id}`, { token: sGuest.token, body: { title: 'Hi', content: 'x' } })).status, 403, 'student');
      eq((await api('POST', `/announcements/club/${club.id}`, { token: otherHead.token, body: { title: 'Hi', content: 'x' } })).status, 403, 'foreign head');
      eq((await api('POST', `/announcements/club/${club.id}`, { token: head.token, body: { title: '', content: 'x' } })).status, 400, 'title required');
      eq((await api('POST', `/announcements/club/${club.id}`, { token: head.token, body: { title: 'Hi', content: 'x', category: 'NOPE' } })).status, 400, 'bad category');

      const activeNow = await prisma.membership.findMany({ where: { clubId: club.id, status: 'ACTIVE', endDate: { gt: new Date() } }, distinct: ['userId'], select: { userId: true } });
      const before = await prisma.notification.count({ where: { type: 'announcement', userId: { in: users } } });
      const r = await api('POST', `/announcements/club/${club.id}`, { token: head.token, body: { title: 'Weekly meeting', content: 'Agenda: fundraiser plan, roles, budget.', category: 'MEETING' } });
      eq([r.status, r.data.announcement.category, r.data.announcement.author.id], [201, 'MEETING', head.id], 'created');
      const after = await prisma.notification.count({ where: { type: 'announcement', userId: { in: users } } });
      eq(after - before, activeNow.length, 'every active member notified once');
      eq(await prisma.notification.count({ where: { type: 'announcement', userId: sGuest.id } }), 0, 'non-members are not notified');

      await api('POST', `/announcements/club/${club.id}`, { token: head.token, body: { title: 'Deadline', content: 'Dues by Friday', category: 'DEADLINE' } });
      const pub = await api('GET', `/announcements/club/${club.id}`);
      eq(pub.status, 200, 'public timeline');
      eq(pub.data.items.map((a: any) => a.title), ['Deadline', 'Weekly meeting'], 'newest first');
      eq((await api('GET', `/announcements/club/${club.id}?category=MEETING`)).data.items.length, 1, 'category filter');
      const feed = await api('GET', '/announcements/feed', { token: sMember.token });
      eq(feed.data.items.length, 2, 'member feed');
      eq((await api('GET', '/announcements/feed', { token: sGuest.token })).data.items.length, 0, 'non-member feed is empty');
    });

    await test('editing and deleting announcements is limited to the club', async () => {
      const a = (await api('GET', `/announcements/club/${club.id}`)).data.items[0];
      eq((await api('PUT', `/announcements/${a.id}`, { token: otherHead.token, body: { title: 'hijack' } })).status, 403, 'foreign edit');
      eq((await api('PUT', `/announcements/${a.id}`, { token: head.token, body: { title: 'Deadline moved' } })).data.announcement.title, 'Deadline moved', 'edit');
      eq((await api('DELETE', `/announcements/${a.id}`, { token: otherHead.token })).status, 403, 'foreign delete');
      eq((await api('DELETE', `/announcements/${a.id}`, { token: head.token })).status, 200, 'delete');
    });

    // ── Treasury ─────────────────────────────────────────────────────────────
    await test('the treasury summary lists dues collected next to ticket and merch income', async () => {
      const s = await api('GET', '/finance/summary', { token: head.token });
      eq(s.status, 200, 'summary');
      const inc = s.data.incomeByCategory ?? s.data.summary?.incomeByCategory;
      check(inc, `income breakdown present: ${s.text.slice(0, 200)}`);
      const dues = (await duesEntries()).reduce((n, e) => n + e.amountPaise, 0);
      eq(inc.DUES, dues, 'dues total');
      eq(inc.TICKET, 14000, 'ticket sales (member 40 + guest 100)');
    });
  } finally {
    await prisma.order.deleteMany({ where: { productId: { in: products } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: products } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { id: { in: events } } }).catch(() => {});
    await prisma.club.deleteMany({ where: { id: club.id } }).catch(() => {});
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
