import { Router, Request, Response } from 'express';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { currentUser } from '../../middlewares/authorize';
import { badRequest, notFound } from '../../middlewares/errorHandler';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../../utils/pagination';
import { oneOf, optStr, str } from '../../utils/params';
import { audit } from '../../utils/audit';
import { postLedger } from '../finance/ledger.service';
import { toPaise } from '../registrations/registrations.service';

const router = Router();
const STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const satisfies readonly RegistrationStatus[];

export function registrationWhere(req: Request): Prisma.RegistrationWhereInput {
  const q = (req.query.search ? String(req.query.search) : '').trim().slice(0, 100);
  const status = oneOf(req.query.status, STATUSES, 'status');
  const eventId = optStr(req.query.eventId);
  const clubId = optStr(req.query.clubId);
  const from = optStr(req.query.from);
  const to = optStr(req.query.to);
  const dateFilter: Prisma.DateTimeFilter = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(+d)) throw badRequest('from must be a valid date.');
    dateFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(+d)) throw badRequest('to must be a valid date.');
    dateFilter.lte = d;
  }
  return {
    AND: [
      status ? { status } : {},
      eventId ? { eventId } : {},
      clubId ? { event: { clubId } } : {},
      from || to ? { createdAt: dateFilter } : {},
      q
        ? {
            OR: [
              { profile: { fullName: { contains: q, mode: 'insensitive' } } },
              { profile: { email: { contains: q, mode: 'insensitive' } } },
              { profile: { usn: { contains: q, mode: 'insensitive' } } },
              { event: { name: { contains: q, mode: 'insensitive' } } },
              { team: { teamName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {},
    ],
  };
}

export const registrationInclude = {
  profile: { select: { id: true, fullName: true, email: true, usn: true, phone: true } },
  event: { select: { id: true, name: true, fee: true, eventDate: true, club: { select: { id: true, name: true } } } },
  team: { select: { id: true, teamName: true } },
} satisfies Prisma.RegistrationInclude;

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const where = registrationWhere(req);
  const [totalItems, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({ where, include: registrationInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  const items = rows.map(r => ({
    ...r,
    paymentStatus: r.feeCharged <= 0 ? 'FREE' : r.status === 'CONFIRMED' ? 'VERIFIED' : r.transactionId ? 'SUBMITTED' : 'UNPAID',
  }));
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

router.put('/:id/status', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const status = oneOf(req.body.status, STATUSES, 'status');
  if (!status) throw badRequest(`status must be one of: ${STATUSES.join(', ')}.`);

  const reg = await prisma.registration.findUnique({ where: { id: str(req.params.id) }, include: { event: true, profile: { select: { email: true } } } });
  if (!reg) throw notFound('Registration not found.');

  const updated = await prisma.$transaction(async tx => {
    const u = await tx.registration.update({ where: { id: reg.id }, data: { status, ...(status !== 'CONFIRMED' ? { checkedInAt: null } : {}) } });
    if (status === 'CONFIRMED' && reg.feeCharged > 0 && reg.transactionId) {
      // Idempotent: (refType, refId, type) is unique in the ledger.
      await postLedger(
        { clubId: reg.event.clubId, type: 'IN', category: 'TICKET', amountPaise: toPaise(reg.feeCharged), refType: 'registration', refId: reg.id, eventId: reg.eventId, memo: `Ticket: ${reg.event.name}`, actorId: actor.id },
        tx
      );
    }
    await audit(actor.id, 'UPDATE_REGISTRATION_STATUS', 'Registration', reg.id, { from: reg.status, to: status, user: reg.profile?.email, event: reg.event.name }, tx);
    return u;
  });
  return res.status(200).json({ registration: updated });
});

router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const reg = await prisma.registration.findUnique({ where: { id: str(req.params.id) }, include: { event: true, profile: { select: { email: true } } } });
  if (!reg) throw notFound('Registration not found.');
  if (reg.status === 'CONFIRMED' && reg.feeCharged > 0 && reg.transactionId) {
    throw badRequest('This registration has a verified payment recorded in the ledger. Reject it instead of deleting.');
  }
  await prisma.registration.delete({ where: { id: reg.id } });
  await audit(actor.id, 'DELETE_REGISTRATION', 'Registration', reg.id, { user: reg.profile?.email, event: reg.event.name });
  return res.status(200).json({ message: 'Registration deleted successfully.' });
});

export default router;
