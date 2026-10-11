import { prisma } from '../../config/db';
import { campusNow } from '../../utils/time';
import { ACTIVE_REGISTRATION_STATUSES } from '../events/events.service';

/**
 * One definition of every "how many events" number, shared by the profile page,
 * the club dashboard and the admin overview so they can never disagree again.
 *
 * Root cause of the old mismatch: the student Profile labelled its number "Events"
 * but counted *every* registration row (rejected included) for the user, while the
 * Events page lists *published events*; and the club dashboard counted archived and
 * unpublished events while the club profile excluded archived ones. Different
 * populations, same label.
 */

/** Student: registrations that still hold a seat (PENDING + CONFIRMED), on non-archived events. */
export async function studentStats(userId: string) {
  const activeWhere = { userId, status: { in: ACTIVE_REGISTRATION_STATUSES }, event: { isArchived: false } };
  const now = campusNow();
  const [activeRegistrations, confirmed, pending, upcoming, attended, clubs] = await Promise.all([
    prisma.registration.count({ where: activeWhere }),
    prisma.registration.count({ where: { ...activeWhere, status: 'CONFIRMED' } }),
    prisma.registration.count({ where: { ...activeWhere, status: 'PENDING' } }),
    prisma.registration.count({ where: { ...activeWhere, event: { isArchived: false, eventDate: { gte: now } } } }),
    prisma.registration.count({ where: { userId, checkedInAt: { not: null } } }),
    prisma.event.findMany({
      where: { registrations: { some: activeWhere } },
      distinct: ['clubId'],
      select: { clubId: true },
    }),
  ]);
  const [orders, saved, memberships] = await Promise.all([
    prisma.order.count({ where: { userId, status: { in: ['PAID', 'PAYMENT_SUBMITTED', 'PENDING_PAYMENT'] } } }),
    prisma.savedEvent.count({ where: { userId } }),
    prisma.membership.findMany({ where: { userId, status: 'ACTIVE', endDate: { gt: new Date() } }, select: { clubId: true }, distinct: ['clubId'] }),
  ]);
  // Clubs the student is involved with: active memberships plus clubs whose events they registered for.
  const clubIds = new Set([...clubs.map(c => c.clubId), ...memberships.map(m => m.clubId)]);

  return {
    role: 'STUDENT' as const,
    /** @deprecated alias of registrationsCount kept for existing clients */
    eventsCount: activeRegistrations,
    registrationsCount: activeRegistrations,
    confirmedCount: confirmed,
    pendingCount: pending,
    upcomingRegistrationsCount: upcoming,
    attendedCount: attended,
    clubsCount: clubIds.size,
    memberOfCount: memberships.length,
    savedCount: saved,
    ordersCount: orders,
  };
}

/** Club head: events of the managed club. "eventsCount" excludes archived (deleted) events. */
export async function clubStats(clubId: string) {
  const now = campusNow();
  const live = { clubId, isArchived: false };
  const [eventsCount, publishedCount, upcomingCount, registrationsCount, pendingCount] = await Promise.all([
    prisma.event.count({ where: live }),
    prisma.event.count({ where: { ...live, isPublished: true } }),
    prisma.event.count({ where: { ...live, eventDate: { gte: now } } }),
    prisma.registration.count({ where: { status: { in: ACTIVE_REGISTRATION_STATUSES }, event: live } }),
    prisma.registration.count({ where: { status: 'PENDING', event: live } }),
  ]);
  return {
    role: 'CLUB_HEAD' as const,
    eventsCount,
    publishedEventsCount: publishedCount,
    unpublishedEventsCount: eventsCount - publishedCount,
    upcomingEventsCount: upcomingCount,
    registrationsCount,
    pendingCount,
    clubsCount: 1,
  };
}

/** Super admin: the whole platform. */
export async function platformStats() {
  const now = campusNow();
  const [
    totalUsers, students, clubHeads, superAdmins, inactiveUsers,
    totalClubs, archivedClubs,
    totalEvents, publishedEvents, archivedEvents, upcomingEvents,
    activeRegistrations, confirmedRegistrations, pendingRegistrations, rejectedRegistrations,
    totalKeys, unusedKeys,
    products, orderGroups,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { role: 'STUDENT' } }),
    prisma.profile.count({ where: { role: 'CLUB_HEAD' } }),
    prisma.profile.count({ where: { role: 'SUPER_ADMIN' } }),
    prisma.profile.count({ where: { isActive: false } }),
    prisma.club.count(),
    prisma.club.count({ where: { isArchived: true } }),
    prisma.event.count({ where: { isArchived: false } }),
    prisma.event.count({ where: { isArchived: false, isPublished: true } }),
    prisma.event.count({ where: { isArchived: true } }),
    prisma.event.count({ where: { isArchived: false, isPublished: true, eventDate: { gte: now } } }),
    prisma.registration.count({ where: { status: { in: ACTIVE_REGISTRATION_STATUSES } } }),
    prisma.registration.count({ where: { status: 'CONFIRMED' } }),
    prisma.registration.count({ where: { status: 'PENDING' } }),
    prisma.registration.count({ where: { status: 'REJECTED' } }),
    prisma.registrationKey.count(),
    prisma.registrationKey.count({ where: { isUsed: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.product.count({ where: { isArchived: false } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalPaise: true } }),
  ]);

  // Gross ticket sales: one fee per confirmed solo registration or per confirmed paying team.
  const ticketRows = await prisma.$queryRaw<Array<{ paise: bigint | number | null }>>`
    SELECT COALESCE(SUM(ROUND(r.fee_charged * 100)), 0) AS paise
    FROM "Registration" r
    WHERE r.status = 'CONFIRMED' AND r.fee_charged > 0 AND r.transaction_id IS NOT NULL`;

  const orders = Object.fromEntries(orderGroups.map(g => [g.status, { count: g._count._all, totalPaise: g._sum.totalPaise ?? 0 }]));

  return {
    users: { total: totalUsers, students, clubHeads, superAdmins, inactive: inactiveUsers },
    clubs: { total: totalClubs, active: totalClubs - archivedClubs, archived: archivedClubs },
    events: { total: totalEvents, published: publishedEvents, unpublished: totalEvents - publishedEvents, archived: archivedEvents, upcoming: upcomingEvents },
    registrations: { active: activeRegistrations, confirmed: confirmedRegistrations, pending: pendingRegistrations, rejected: rejectedRegistrations },
    keys: { total: totalKeys, available: unusedKeys },
    merchandise: {
      products,
      orders,
      paidSalesPaise: orders.PAID?.totalPaise ?? 0,
    },
    /** Gross sales revenue only — not profit, since costs are tracked separately in the ledger. */
    ticketSalesPaise: Number(ticketRows[0]?.paise ?? 0),
  };
}
