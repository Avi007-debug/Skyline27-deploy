import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Club membership and member pricing: the single place that decides "is this student a member of that
 * club right now" and "what do they pay". Event registration, merch checkout, the door scanner and the
 * listings all call these, so the answer can never differ between screens.
 *
 * A student is an active member while a Membership row is ACTIVE and its end date is in the future.
 * Expiry is evaluated here at read time, so no background job is needed.
 */

export const MEMBER_BADGE = '[ACTIVE CLUB MEMBER]';
export const GUEST_BADGE = '[GUEST / NON-MEMBER]';
/** Show a renewal reminder when a membership ends within this many days. */
export const RENEWAL_WINDOW_DAYS = 7;

const activeWhere = (now: Date): Prisma.MembershipWhereInput => ({ status: 'ACTIVE', endDate: { gt: now } });

export async function isActiveMember(userId: string, clubId: string | null | undefined, db: Db = prisma, now = new Date()): Promise<boolean> {
  if (!clubId) return false;
  const row = await db.membership.findFirst({ where: { userId, clubId, ...activeWhere(now) }, select: { id: true } });
  return !!row;
}

/** Which of these users are active members of the club (one query, for rosters and scanner results). */
export async function activeMemberIds(clubId: string, userIds: string[], db: Db = prisma, now = new Date()): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db.membership.findMany({
    where: { clubId, userId: { in: userIds }, ...activeWhere(now) },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(rows.map(r => r.userId));
}

/** Which of these clubs the user is an active member of (one query, for lists of events or products). */
export async function memberClubIds(userId: string, clubIds: Array<string | null | undefined>, db: Db = prisma, now = new Date()): Promise<Set<string>> {
  const ids = [...new Set(clubIds.filter((c): c is string => !!c))];
  if (ids.length === 0) return new Set();
  const rows = await db.membership.findMany({
    where: { userId, clubId: { in: ids }, ...activeWhere(now) },
    select: { clubId: true },
    distinct: ['clubId'],
  });
  return new Set(rows.map(r => r.clubId));
}

/** Rupees an event costs this person: the member fee for members (never above the normal fee), else the fee. */
export function eventPrice(event: { fee: number; memberFee: number | null }, member: boolean): number {
  if (!member || event.memberFee === null || event.memberFee === undefined) return event.fee;
  return Math.min(event.fee, event.memberFee);
}

/** Paise a merchandise unit costs this person, given the unit price before any member discount. */
export function productUnitPaise(basePaise: number, discountPercent: number, member: boolean): number {
  if (!member || discountPercent <= 0) return basePaise;
  return Math.max(0, Math.round((basePaise * (100 - discountPercent)) / 100));
}

/** The membership state a student sees for one club: active, expiring soon, expired or none. */
export async function membershipSummary(userId: string, clubId: string, db: Db = prisma, now = new Date()) {
  const [latestActive, pending, last] = await Promise.all([
    db.membership.findFirst({ where: { userId, clubId, ...activeWhere(now) }, orderBy: { endDate: 'desc' } }),
    db.membership.findFirst({ where: { userId, clubId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
    db.membership.findFirst({ where: { userId, clubId, status: 'ACTIVE' }, orderBy: { endDate: 'desc' } }),
  ]);
  const end = latestActive?.endDate ?? last?.endDate ?? null;
  const daysLeft = latestActive?.endDate ? Math.ceil((latestActive.endDate.getTime() - now.getTime()) / 86400000) : null;
  const state: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NONE' = latestActive
    ? daysLeft !== null && daysLeft <= RENEWAL_WINDOW_DAYS
      ? 'EXPIRING'
      : 'ACTIVE'
    : last
      ? 'EXPIRED'
      : 'NONE';
  return {
    state,
    isMember: !!latestActive,
    endDate: end,
    daysLeft,
    pendingPayment: pending ? { id: pending.id, createdAt: pending.createdAt, duesPaidPaise: pending.duesPaidPaise } : null,
  };
}
