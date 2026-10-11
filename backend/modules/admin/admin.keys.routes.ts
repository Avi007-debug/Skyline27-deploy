import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { currentUser } from '../../middlewares/authorize';
import { badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { generateRegistrationKey } from '../../utils/crypto';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../../utils/pagination';
import { oneOf, optInt, str } from '../../utils/params';
import { audit, maskKey } from '../../utils/audit';

const router = Router();

const keyInclude = { usedByClub: { select: { id: true, name: true, email: true } } } satisfies Prisma.RegistrationKeyInclude;

type KeyStatus = 'AVAILABLE' | 'USED' | 'EXPIRED';
const statusOf = (k: { isUsed: boolean; expiresAt: Date | null }, now = new Date()): KeyStatus =>
  k.isUsed ? 'USED' : k.expiresAt && k.expiresAt <= now ? 'EXPIRED' : 'AVAILABLE';
const withStatus = <T extends { isUsed: boolean; expiresAt: Date | null }>(k: T) => ({ ...k, status: statusOf(k) });

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const status = oneOf(req.query.status, ['AVAILABLE', 'USED', 'EXPIRED'] as const, 'status');
  const now = new Date();

  const where: Prisma.RegistrationKeyWhereInput = {
    AND: [
      status === 'USED' ? { isUsed: true } : {},
      status === 'AVAILABLE' ? { isUsed: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {},
      status === 'EXPIRED' ? { isUsed: false, expiresAt: { lte: now } } : {},
      params.search
        ? { OR: [{ code: { contains: params.search, mode: 'insensitive' } }, { usedByClub: { name: { contains: params.search, mode: 'insensitive' } } }] }
        : {},
    ],
  };
  const [totalItems, keys] = await Promise.all([
    prisma.registrationKey.count({ where }),
    prisma.registrationKey.findMany({ where, include: keyInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(keys.map(withStatus), totalItems, params));
});

/**
 * Generate a registration key (cryptographically secure unless a custom code is
 * supplied). The response contains the exact key that was created, so the UI can
 * show it immediately instead of re-fetching a list.
 */
router.post('/generate', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const expiresInDays = optInt(req.body.expiresInDays, 'expiresInDays', { min: 1, max: 365 });
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const custom = str(req.body.customCode).toUpperCase();
  if (custom && !/^[A-Z0-9-]{6,32}$/.test(custom)) {
    throw badRequest('Custom codes must be 6–32 characters: letters, digits and dashes.');
  }

  let key;
  if (custom) {
    if (await prisma.registrationKey.findUnique({ where: { code: custom } })) throw conflict('This registration code already exists.');
    key = await prisma.registrationKey.create({ data: { code: custom, expiresAt, createdById: actor.id }, include: keyInclude });
  } else {
    // 40 bits of entropy per key; retry on the astronomically unlikely collision.
    for (let attempt = 0; attempt < 5 && !key; attempt++) {
      try {
        key = await prisma.registrationKey.create({ data: { code: generateRegistrationKey('SKYLINE'), expiresAt, createdById: actor.id }, include: keyInclude });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
    if (!key) throw conflict('Could not generate a unique key. Please try again.');
  }

  await audit(actor.id, 'GENERATE_REGISTRATION_KEY', 'RegistrationKey', key.id, { code: maskKey(key.code), expiresAt });
  return res.status(201).json({ key: withStatus(key) });
});

/** Revoke an unused key. Used keys are history and cannot be removed. */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const key = await prisma.registrationKey.findUnique({ where: { id: str(req.params.id) } });
  if (!key) throw notFound('Key not found.');
  if (key.isUsed) throw badRequest('Cannot delete a key that has already been used.');
  await prisma.registrationKey.delete({ where: { id: key.id } });
  await audit(actor.id, 'REVOKE_REGISTRATION_KEY', 'RegistrationKey', key.id, { code: maskKey(key.code) });
  return res.status(200).json({ message: 'Registration key revoked.' });
});

export default router;
