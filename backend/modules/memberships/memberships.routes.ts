import { Router, Request, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { optionalAuth } from '../../middlewares/authenticate';
import { requireRole, requireClubManager, assertClubAccess, currentUser, resolveClubScope } from '../../middlewares/authorize';
import { sensitiveLimiter } from '../../middlewares/rateLimit';
import { badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { buildPaginatedResult, parsePaginationParams, prismaSkipTake } from '../../utils/pagination';
import { oneOf, optStr, requiredStr, str } from '../../utils/params';
import { audit } from '../../utils/audit';
import { postLedger } from '../finance/ledger.service';
import { RENEWAL_WINDOW_DAYS, membershipSummary } from './membership.service';

/**
 * Club memberships. Students join (or renew) by paying the club's dues by UPI and submitting the
 * reference; the club head verifies it, which activates the membership and records the dues in the
 * ledger in the same transaction. Member pricing elsewhere reads the same data via membership.service.
 */
const router = Router();
const requireStudent = requireRole(Role.STUDENT);

const TXN = /^[A-Za-z0-9-]{6,64}$/;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

const clubOffer = (c: { id: string; name: string; logoUrl: string | null; upiId: string | null; qrUrl: string | null; membershipFeePaise: number; membershipMonths: number }) => ({
  id: c.id,
  name: c.name,
  logoUrl: c.logoUrl,
  membershipFeePaise: c.membershipFeePaise,
  membershipMonths: c.membershipMonths,
  free: c.membershipFeePaise === 0,
  payment: c.membershipFeePaise > 0 ? { upiId: c.upiId, qrUrl: c.qrUrl } : null,
});

const clubOfferSelect = { id: true, name: true, logoUrl: true, upiId: true, qrUrl: true, membershipFeePaise: true, membershipMonths: true, isArchived: true } as const;

// ─── Student ──────────────────────────────────────────────────────────────────

/** A club's membership offer, plus the signed-in student's own standing with that club. */
router.get('/club/:clubId', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  const club = await prisma.club.findUnique({ where: { id: str(req.params.clubId) }, select: clubOfferSelect });
  if (!club || club.isArchived) throw notFound('Club not found.');
  const mine = req.user && req.user.role === Role.STUDENT ? await membershipSummary(req.user.id, club.id) : null;
  return res.status(200).json({ club: clubOffer(club), membership: mine });
});

/**
 * Every club the student has a membership with (any state), with the state banner to show.
 * Sends one renewal reminder notification per membership period when it is about to expire.
 */
router.get('/mine', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const rows = await prisma.membership.findMany({ where: { userId: user.id }, select: { clubId: true }, distinct: ['clubId'] });
  const clubs = await prisma.club.findMany({ where: { id: { in: rows.map(r => r.clubId) } }, select: clubOfferSelect });

  const items = await Promise.all(
    clubs.map(async c => {
      const summary = await membershipSummary(user.id, c.id);
      return { club: clubOffer(c), ...summary };
    })
  );

  for (const m of items) {
    if (m.state !== 'EXPIRING' || !m.endDate) continue;
    const title = `Your ${m.club.name} membership ends soon`;
    const already = await prisma.notification.findFirst({ where: { userId: user.id, type: 'membership_expiring', title, createdAt: { gt: new Date(m.endDate.getTime() - RENEWAL_WINDOW_DAYS * 86400000) } }, select: { id: true } });
    if (!already) {
      await prisma.notification.create({
        data: { userId: user.id, type: 'membership_expiring', title, body: `Renew before ${m.endDate.toDateString()} to keep member prices.` },
      });
    }
  }
  return res.status(200).json({ memberships: items });
});

/** Join, or renew (allowed once the current period is within the renewal window or has ended). */
router.post('/club/:clubId/join', requireStudent, sensitiveLimiter, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const club = await prisma.club.findUnique({ where: { id: str(req.params.clubId) }, select: clubOfferSelect });
  if (!club || club.isArchived) throw notFound('Club not found.');

  const free = club.membershipFeePaise === 0;
  let transactionId: string | null = null;
  if (!free) {
    transactionId = requiredStr(req.body.transactionId, 'Transaction ID', 64);
    if (!TXN.test(transactionId)) throw badRequest('Transaction ID must be 6–64 letters, digits or dashes.');
  }

  try {
    const membership = await prisma.$transaction(async tx => {
      const current = await membershipSummary(user.id, club.id, tx);
      if (current.state === 'ACTIVE') throw conflict(`You are already a member until ${current.endDate!.toDateString()}. Renewal opens ${RENEWAL_WINDOW_DAYS} days before it ends.`);
      if (current.pendingPayment) throw conflict('Your membership payment for this club is already awaiting review.');

      if (free) {
        const start = current.endDate && current.endDate > new Date() ? current.endDate : new Date();
        return tx.membership.create({
          data: { userId: user.id, clubId: club.id, status: 'ACTIVE', startDate: start, endDate: addMonths(start, club.membershipMonths), duesPaidPaise: 0 },
        });
      }
      return tx.membership.create({ data: { userId: user.id, clubId: club.id, status: 'PENDING', duesPaidPaise: club.membershipFeePaise, transactionId } });
    });
    return res.status(201).json({ membership, message: free ? 'You are now a member.' : 'Payment submitted. The club will verify it shortly.' });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('This transaction ID has already been used.');
    if (typeof err?.message === 'string' && err.message.includes('already awaiting review')) throw conflict('Your membership payment for this club is already awaiting review.');
    throw err;
  }
});

/** Withdraw a payment that has not been reviewed yet. */
router.delete('/:id', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const removed = await prisma.membership.deleteMany({ where: { id: str(req.params.id), userId: user.id, status: 'PENDING' } });
  if (removed.count === 0) throw notFound('No pending membership payment found.');
  return res.status(200).json({ deleted: true });
});

// ─── Club head / super admin ──────────────────────────────────────────────────

const STATES = ['pending', 'active', 'expiring', 'expired', 'rejected'] as const;

function stateWhere(state: (typeof STATES)[number] | undefined, now: Date): Prisma.MembershipWhereInput {
  const soon = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 86400000);
  switch (state) {
    case 'pending': return { status: 'PENDING' };
    case 'rejected': return { status: 'REJECTED' };
    case 'active': return { status: 'ACTIVE', endDate: { gt: now } };
    case 'expiring': return { status: 'ACTIVE', endDate: { gt: now, lte: soon } };
    case 'expired': return { status: 'ACTIVE', endDate: { lte: now } };
    default: return {};
  }
}

router.get('/manage', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const clubId = resolveClubScope(user, optStr(req.query.clubId));
  const state = oneOf(optStr(req.query.state), STATES, 'state');
  const search = optStr(req.query.search);
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const now = new Date();

  const where: Prisma.MembershipWhereInput = {
    ...(clubId ? { clubId } : {}),
    ...stateWhere(state, now),
    ...(search ? { user: { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { usn: { contains: search, mode: 'insensitive' } }] } } : {}),
  };
  const [totalItems, rows] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true, usn: true, branch: true, phone: true } }, club: { select: { id: true, name: true } } },
      orderBy: state === 'pending' ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take,
    }),
  ]);
  const items = rows.map(m => ({
    ...m,
    state: m.status === 'ACTIVE' ? (m.endDate! > now ? 'ACTIVE' : 'EXPIRED') : m.status,
  }));
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

router.get('/manage/summary', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const clubId = resolveClubScope(user, optStr(req.query.clubId));
  const now = new Date();
  const base = clubId ? { clubId } : {};
  const [active, expiring, pending] = await Promise.all([
    prisma.membership.findMany({ where: { ...base, ...stateWhere('active', now) }, select: { userId: true, clubId: true }, distinct: ['userId', 'clubId'] }),
    prisma.membership.count({ where: { ...base, ...stateWhere('expiring', now) } }),
    prisma.membership.count({ where: { ...base, status: 'PENDING' } }),
  ]);
  const club = clubId ? await prisma.club.findUnique({ where: { id: clubId }, select: { membershipFeePaise: true, membershipMonths: true } }) : null;
  return res.status(200).json({ activeMembers: active.length, expiringSoon: expiring, pendingPayments: pending, settings: club });
});

/** Dues must be set before students can join; 0 makes membership free. */
router.put('/manage/settings', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const clubId = resolveClubScope(user, optStr(req.body.clubId));
  if (!clubId) throw badRequest('clubId is required.');
  const data: Prisma.ClubUpdateInput = {};
  if (req.body.membershipFeePaise !== undefined) {
    const n = Number(req.body.membershipFeePaise);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw badRequest('Membership dues must be a whole number of paise (0 or more).');
    data.membershipFeePaise = n;
  }
  if (req.body.membershipMonths !== undefined) {
    const n = Number(req.body.membershipMonths);
    if (!Number.isInteger(n) || n < 1 || n > 60) throw badRequest('Membership length must be between 1 and 60 months.');
    data.membershipMonths = n;
  }
  const club = await prisma.club.update({ where: { id: clubId }, data, select: { membershipFeePaise: true, membershipMonths: true } });
  await audit(user.id, 'UPDATE_MEMBERSHIP_SETTINGS', 'Club', clubId, data as any);
  return res.status(200).json({ settings: club });
});

async function loadForReview(req: Request) {
  const user = currentUser(req);
  const membership = await prisma.membership.findUnique({ where: { id: str(req.params.id) }, include: { club: { select: { id: true, name: true, membershipMonths: true } } } });
  if (!membership) throw notFound('Membership not found.');
  assertClubAccess(user, membership.clubId);
  return { user, membership };
}

/**
 * Confirm the dues arrived. Activation and the ledger entry share one transaction; the conditional
 * status update plus the ledger's unique (refType, refId) make a double click a no-op.
 */
router.post('/manage/:id/verify', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, membership } = await loadForReview(req);
  const result = await prisma.$transaction(async tx => {
    const now = new Date();
    // A renewal begins when the current period ends, so paying early never loses days.
    const running = await tx.membership.findFirst({
      where: { userId: membership.userId, clubId: membership.clubId, status: 'ACTIVE', endDate: { gt: now } },
      orderBy: { endDate: 'desc' },
      select: { endDate: true },
    });
    const start = running?.endDate ?? now;
    const changed = await tx.membership.updateMany({
      where: { id: membership.id, status: 'PENDING' },
      data: { status: 'ACTIVE', startDate: start, endDate: addMonths(start, membership.club.membershipMonths), verifiedById: user.id, verifiedAt: now },
    });
    if (changed.count === 0) {
      const current = await tx.membership.findUniqueOrThrow({ where: { id: membership.id } });
      if (current.status === 'ACTIVE') return { membership: current, duplicate: true };
      throw conflict(`Only pending payments can be verified (this one is ${current.status.toLowerCase()}).`);
    }

    if (membership.duesPaidPaise > 0) {
      await postLedger(
        { clubId: membership.clubId, type: 'IN', category: 'DUES', amountPaise: membership.duesPaidPaise, refType: 'membership', refId: membership.id, memo: `Membership dues: ${membership.club.name}`, actorId: user.id },
        tx
      );
    }
    const done = await tx.membership.findUniqueOrThrow({ where: { id: membership.id } });
    await tx.notification.create({
      data: {
        userId: membership.userId,
        type: 'membership_approved',
        title: `Welcome to ${membership.club.name}`,
        body: `Your membership is active until ${done.endDate!.toDateString()}. Member prices now apply.`,
      },
    });
    await audit(user.id, 'VERIFY_MEMBERSHIP', 'Membership', membership.id, { clubId: membership.clubId, duesPaidPaise: membership.duesPaidPaise }, tx);
    return { membership: done, duplicate: false };
  });
  return res.status(200).json(result);
});

router.post('/manage/:id/reject', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, membership } = await loadForReview(req);
  const reason = str(req.body.reason).slice(0, 300);
  await prisma.$transaction(async tx => {
    const changed = await tx.membership.updateMany({ where: { id: membership.id, status: 'PENDING' }, data: { status: 'REJECTED', verifiedById: user.id, verifiedAt: new Date() } });
    if (changed.count === 0) throw conflict('Only pending payments can be rejected.');
    await tx.notification.create({
      data: {
        userId: membership.userId,
        type: 'membership_rejected',
        title: `${membership.club.name} membership payment not accepted`,
        body: reason || 'The payment could not be verified. Please check the reference and submit again.',
      },
    });
    await audit(user.id, 'REJECT_MEMBERSHIP', 'Membership', membership.id, { clubId: membership.clubId, reason }, tx);
  });
  return res.status(200).json({ message: 'Membership payment rejected.' });
});

export default router;
