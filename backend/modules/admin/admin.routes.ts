import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireSuperAdmin, currentUser } from '../../middlewares/authorize';
import { sensitiveLimiter } from '../../middlewares/rateLimit';
import { badRequest } from '../../middlewares/errorHandler';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../../utils/pagination';
import { optStr } from '../../utils/params';
import { audit } from '../../utils/audit';
import { toCsv } from '../../utils/csv';
import { platformStats } from '../profiles/stats.service';
import usersRouter from './admin.users.routes';
import clubsRouter from './admin.clubs.routes';
import keysRouter from './admin.keys.routes';
import registrationsRouter, { registrationInclude, registrationWhere } from './admin.registrations.routes';

/**
 * Super Admin console API. One guard protects the entire router, so a new
 * endpoint added here is protected by default.
 */
const router = Router();
router.use(requireSuperAdmin);

router.use('/users', usersRouter);
router.use('/clubs', clubsRouter);
router.use('/registration-keys', keysRouter);
router.use('/registrations', registrationsRouter);
// Events and merchandise are managed through the shared /events and /merchandise
// management endpoints, which grant a Super Admin access to every club.

router.get('/stats', async (_req: Request, res: Response): Promise<any> => {
  const [stats, recentAuditLogs] = await Promise.all([
    platformStats(),
    prisma.auditLog.findMany({ take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { actor: { select: { id: true, fullName: true, email: true } } } }),
  ]);
  return res.status(200).json({ stats, recentAuditLogs });
});

router.get('/audit-logs', async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const entityType = optStr(req.query.entityType);
  const action = optStr(req.query.action);
  const actorId = optStr(req.query.actorId);
  const where: Prisma.AuditLogWhereInput = {
    AND: [
      entityType ? { entityType } : {},
      action ? { action } : {},
      actorId ? { actorId } : {},
      params.search
        ? {
            OR: [
              { action: { contains: params.search, mode: 'insensitive' } },
              { entityType: { contains: params.search, mode: 'insensitive' } },
              { entityId: { contains: params.search, mode: 'insensitive' } },
              { actor: { email: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {},
    ],
  };
  const [totalItems, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { actor: { select: { id: true, fullName: true, email: true } } } }),
  ]);
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

// ─── Reports (CSV) ────────────────────────────────────────────────────────────

const EXPORT_LIMIT = 10000;

router.get('/reports/registrations.csv', sensitiveLimiter, async (req: Request, res: Response): Promise<any> => {
  const rows = await prisma.registration.findMany({
    where: registrationWhere(req),
    include: registrationInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: EXPORT_LIMIT,
  });
  const csv = toCsv(
    ['Registration ID', 'Event', 'Club', 'Student', 'Email', 'USN', 'Team', 'Status', 'Fee (INR)', 'Transaction ID', 'Registered At'],
    rows.map(r => [r.id, r.event.name, r.event.club.name, r.profile?.fullName, r.profile?.email, r.profile?.usn, r.team?.teamName, r.status, r.event.fee, r.transactionId, r.createdAt.toISOString()])
  );
  await audit(currentUser(req).id, 'EXPORT_REGISTRATIONS', 'Report', 'registrations', { rows: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="skyline_registrations.csv"');
  return res.status(200).send(csv);
});

/** Per-club and per-event registration & sales-revenue summary for a date range. Revenue is gross sales, not profit. */
router.get('/reports/summary', async (req: Request, res: Response): Promise<any> => {
  const from = optStr(req.query.from);
  const to = optStr(req.query.to);
  const range: Prisma.DateTimeFilter = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(+d)) throw badRequest('from must be a valid date.');
    range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(+d)) throw badRequest('to must be a valid date.');
    range.lte = d;
  }
  const regWhere: Prisma.RegistrationWhereInput = from || to ? { createdAt: range } : {};

  const groups = await prisma.registration.groupBy({ by: ['eventId', 'status'], where: regWhere, _count: { _all: true } });
  const events = await prisma.event.findMany({
    where: { id: { in: [...new Set(groups.map(g => g.eventId))] } },
    select: { id: true, name: true, fee: true, clubId: true, club: { select: { name: true } } },
  });
  const sales = await prisma.registration.groupBy({ by: ['eventId'], where: { ...regWhere, status: 'CONFIRMED' }, _sum: { feeCharged: true } });
  const salesByEvent = new Map(sales.map(s => [s.eventId, s._sum.feeCharged ?? 0]));
  const byEvent = events.map(e => {
    const c = (s: string) => groups.find(g => g.eventId === e.id && g.status === s)?._count._all ?? 0;
    const confirmed = c('CONFIRMED');
    return {
      eventId: e.id, event: e.name, clubId: e.clubId, club: e.club.name,
      confirmed, pending: c('PENDING'), rejected: c('REJECTED'),
      grossSalesInr: Math.round((salesByEvent.get(e.id) ?? 0) * 100) / 100,
    };
  });
  const byClubMap = new Map<string, { clubId: string; club: string; confirmed: number; pending: number; grossSalesInr: number }>();
  for (const e of byEvent) {
    const cur = byClubMap.get(e.clubId) ?? { clubId: e.clubId, club: e.club, confirmed: 0, pending: 0, grossSalesInr: 0 };
    cur.confirmed += e.confirmed;
    cur.pending += e.pending;
    cur.grossSalesInr = Math.round((cur.grossSalesInr + e.grossSalesInr) * 100) / 100;
    byClubMap.set(e.clubId, cur);
  }

  const orderWhere: Prisma.OrderWhereInput = { status: 'PAID', ...(from || to ? { paidAt: range } : {}) };
  const orderAgg = await prisma.order.aggregate({ where: orderWhere, _sum: { totalPaise: true }, _count: { _all: true } });

  return res.status(200).json({
    range: { from: from ?? null, to: to ?? null },
    clubs: [...byClubMap.values()],
    events: byEvent,
    merchandise: { paidOrders: orderAgg._count._all, grossSalesPaise: orderAgg._sum.totalPaise ?? 0 },
    note: 'Figures are gross sales revenue. Profit requires attributable costs from the finance ledger.',
  });
});

// ─── Maintenance ──────────────────────────────────────────────────────────────

router.post('/maintenance/clean-expired-tokens', async (req: Request, res: Response): Promise<any> => {
  const result = await prisma.profile.updateMany({
    where: { passwordResetExpiry: { lt: new Date() } },
    data: { passwordResetToken: null, passwordResetExpiry: null },
  });
  await audit(currentUser(req).id, 'DB_CLEANUP_EXPIRED_TOKENS', 'Profile', 'SYSTEM', { cleaned: result.count });
  return res.status(200).json({ message: `Cleaned ${result.count} expired reset tokens.` });
});

export default router;
