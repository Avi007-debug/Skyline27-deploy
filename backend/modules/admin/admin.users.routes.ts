import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { currentUser } from '../../middlewares/authorize';
import { badRequest, conflict, forbidden, notFound } from '../../middlewares/errorHandler';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake, searchAny } from '../../utils/pagination';
import { oneOf, optBool, optInt, optStr, str } from '../../utils/params';
import { audit } from '../../utils/audit';
import { SALT_ROUNDS, validateEmail, validatePassword } from '../auth/auth.service';

const router = Router();

/** Private fields are never selected: no password hash, no reset token. */
const userSelect = {
  id: true, fullName: true, email: true, usn: true, branch: true, phone: true, year: true, sem: true,
  role: true, clubId: true, isActive: true, createdAt: true,
  club: { select: { id: true, name: true, logoUrl: true } },
} satisfies Prisma.ProfileSelect;

const ROLE_VALUES = [Role.STUDENT, Role.CLUB_HEAD, Role.SUPER_ADMIN] as const;

async function activeSuperAdminCount(exceptId?: string): Promise<number> {
  return prisma.profile.count({ where: { role: Role.SUPER_ADMIN, isActive: true, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const role = oneOf(req.query.role, ROLE_VALUES, 'role');
  const active = optBool(req.query.active);
  const clubId = optStr(req.query.clubId);

  const where: Prisma.ProfileWhereInput = {
    AND: [
      role ? { role } : {},
      active !== undefined ? { isActive: active } : {},
      clubId ? { clubId } : {},
      searchAny(params.search, ['fullName', 'email', 'usn']) ?? {},
    ],
  };
  const [totalItems, items] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({ where, select: userSelect, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  const id = str(req.params.id);
  const user = await prisma.profile.findUnique({
    where: { id },
    select: {
      ...userSelect,
      registrations: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, createdAt: true, event: { select: { id: true, name: true, eventDate: true } } },
      },
      orders: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, productName: true, variantLabel: true, quantity: true, totalPaise: true, status: true, createdAt: true },
      },
    },
  });
  if (!user) throw notFound('User not found.');
  return res.status(200).json({ user });
});

/** Create another super admin (the first one is created with `npm run admin:create`). */
router.post('/super-admin', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const email = validateEmail(req.body.email);
  const password = validatePassword(req.body.password);
  const name = str(req.body.name);
  if (!name) throw badRequest('Name is required.');
  if ((await prisma.profile.findUnique({ where: { email } })) || (await prisma.club.findUnique({ where: { email } }))) {
    throw conflict('An account with this email already exists.');
  }
  const user = await prisma.profile.create({
    data: {
      id: `user_${crypto.randomBytes(6).toString('hex')}`,
      email,
      fullName: name.slice(0, 120),
      password: await bcrypt.hash(password, SALT_ROUNDS),
      role: Role.SUPER_ADMIN,
    },
    select: userSelect,
  });
  await audit(actor.id, 'CREATE_SUPER_ADMIN', 'Profile', user.id, { email });
  return res.status(201).json({ user });
});

router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found.');

  const b = req.body ?? {};
  const data: Prisma.ProfileUpdateInput = {};
  if (b.fullName !== undefined) {
    const n = str(b.fullName);
    if (!n) throw badRequest('Name cannot be empty.');
    data.fullName = n.slice(0, 120);
  }
  if (b.email !== undefined) {
    const email = validateEmail(b.email);
    if (email !== existing.email) {
      if ((await prisma.profile.findUnique({ where: { email } })) || (await prisma.club.findUnique({ where: { email } }))) {
        throw conflict('This email is already in use.');
      }
      data.email = email;
    }
  }
  for (const f of ['usn', 'branch', 'phone'] as const) {
    if (b[f] !== undefined) data[f] = str(b[f]) || null;
  }
  if (data.usn && data.usn !== existing.usn && (await prisma.profile.findUnique({ where: { usn: data.usn as string } }))) {
    throw conflict('This USN is already registered.');
  }
  if (b.year !== undefined) data.year = optInt(b.year, 'year', { min: 1, max: 6 }) ?? null;
  if (b.sem !== undefined) data.sem = optInt(b.sem, 'sem', { min: 1, max: 12 }) ?? null;

  const user = await prisma.profile.update({ where: { id }, data, select: userSelect });
  await audit(actor.id, 'UPDATE_USER_DETAILS', 'Profile', id, { fields: Object.keys(data) });
  return res.status(200).json({ user });
});

/**
 * Change a user's role. CLUB_HEAD requires a club; STUDENT detaches from any club.
 * Guards: no self role-change, and the last active super admin can never be demoted.
 */
router.put('/:id/role', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const role = oneOf(req.body.role, ROLE_VALUES, 'role');
  if (!role) throw badRequest(`role must be one of: ${ROLE_VALUES.join(', ')}.`);
  if (id === actor.id) throw forbidden('You cannot change your own role.');

  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found.');
  if (existing.role === Role.SUPER_ADMIN && role !== Role.SUPER_ADMIN && (await activeSuperAdminCount(id)) === 0) {
    throw forbidden('Cannot demote the last active Super Admin.');
  }

  let clubId: string | null = null;
  if (role === Role.CLUB_HEAD) {
    clubId = str(req.body.clubId) || existing.clubId;
    if (!clubId) throw badRequest('clubId is required to make a user a Club Head.');
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw notFound('Club not found.');
    if (club.isArchived) throw badRequest('Cannot assign a head to an archived club.');
  }

  const user = await prisma.profile.update({ where: { id }, data: { role, clubId }, select: userSelect });
  await audit(actor.id, 'UPDATE_USER_ROLE', 'Profile', id, { from: existing.role, to: role, clubId });
  return res.status(200).json({ user });
});

/** Activate / deactivate an account. Deactivated users cannot authenticate. */
router.put('/:id/status', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const isActive = optBool(req.body.isActive);
  if (isActive === undefined) throw badRequest('isActive (true/false) is required.');
  if (id === actor.id) throw forbidden('You cannot deactivate your own account.');

  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found.');
  if (!isActive && existing.role === Role.SUPER_ADMIN && (await activeSuperAdminCount(id)) === 0) {
    throw forbidden('Cannot deactivate the last active Super Admin.');
  }
  const user = await prisma.profile.update({ where: { id }, data: { isActive }, select: userSelect });
  await audit(actor.id, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'Profile', id, { email: existing.email });
  return res.status(200).json({ user });
});

/** Permanently delete a user. Orders and audit entries keep their snapshots (FKs are SET NULL). */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  if (id === actor.id) throw forbidden('You cannot delete your own account.');
  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found.');
  if (existing.role === Role.SUPER_ADMIN) throw forbidden('Super Admin accounts must be demoted before deletion.');
  if (str(req.body?.confirm).toLowerCase() !== existing.email) {
    throw badRequest('To delete this user send { "confirm": "<the user email>" }. Consider deactivating instead.');
  }
  await audit(actor.id, 'DELETE_USER', 'Profile', id, { email: existing.email, name: existing.fullName });
  await prisma.profile.delete({ where: { id } });
  return res.status(200).json({ message: 'User deleted successfully.' });
});

export default router;
