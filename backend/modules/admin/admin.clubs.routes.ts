import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { currentUser } from '../../middlewares/authorize';
import { badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake, searchAny } from '../../utils/pagination';
import { optBool, str } from '../../utils/params';
import { uploadBase64Image, deleteImage } from '../../utils/storage';
import { audit } from '../../utils/audit';
import { SALT_ROUNDS, validateEmail, validatePassword } from '../auth/auth.service';
import { clubStats } from '../profiles/stats.service';

const router = Router();

const headSelect = { id: true, fullName: true, email: true, role: true, isActive: true } satisfies Prisma.ProfileSelect;

/** Passwords never leave the server. */
const withoutPassword = <T extends { password?: unknown }>(club: T) => {
  const { password: _pw, ...rest } = club;
  return rest;
};

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const archived = optBool(req.query.archived);
  const where: Prisma.ClubWhereInput = {
    AND: [archived === undefined ? {} : { isArchived: archived }, searchAny(params.search, ['name', 'email']) ?? {}],
  };
  const [totalItems, clubs] = await Promise.all([
    prisma.club.count({ where }),
    prisma.club.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take,
      include: { admins: { select: headSelect }, _count: { select: { events: true, products: true } } },
    }),
  ]);
  return res.status(200).json(buildPaginatedResult(clubs.map(withoutPassword), totalItems, params));
});

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  const id = str(req.params.id);
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      admins: { select: headSelect },
      events: {
        orderBy: { eventDate: 'desc' },
        take: 50,
        select: { id: true, name: true, eventDate: true, isPublished: true, isArchived: true, _count: { select: { registrations: true } } },
      },
      _count: { select: { events: true, products: true, registrationKeys: true } },
    },
  });
  if (!club) throw notFound('Club not found.');
  return res.status(200).json({ club: withoutPassword(club), stats: await clubStats(id) });
});

/** Super Admin creates a club directly (no registration key needed). */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const name = str(req.body.name);
  if (!name) throw badRequest('Club name is required.');
  const email = validateEmail(req.body.email);
  const password = validatePassword(req.body.password);
  if ((await prisma.club.findUnique({ where: { email } })) || (await prisma.profile.findUnique({ where: { email } }))) {
    throw conflict('An account or club with this email already exists.');
  }
  const logoUrl = req.body.logoUrl ? await uploadBase64Image(String(req.body.logoUrl), 'clubs/logos') : null;
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const club = await prisma.$transaction(async tx => {
    const created = await tx.club.create({ data: { name: name.slice(0, 120), email, password: hashed, logoUrl, upiId: str(req.body.upiId) || null } });
    await tx.profile.create({
      data: { id: `user_${crypto.randomBytes(6).toString('hex')}`, email, fullName: `${name} Admin`.slice(0, 120), password: hashed, clubId: created.id, role: Role.CLUB_HEAD },
    });
    await audit(actor.id, 'CREATE_CLUB', 'Club', created.id, { name, via: 'admin' }, tx);
    return created;
  });
  return res.status(201).json({ club: withoutPassword(club) });
});

router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw notFound('Club not found.');

  const data: Prisma.ClubUpdateInput = {};
  if (req.body.name !== undefined) {
    const n = str(req.body.name);
    if (!n) throw badRequest('Club name cannot be empty.');
    data.name = n.slice(0, 120);
  }
  if (req.body.email !== undefined) {
    const email = validateEmail(req.body.email);
    if (email !== club.email) {
      if ((await prisma.club.findUnique({ where: { email } })) || (await prisma.profile.findFirst({ where: { email, NOT: { clubId: id } } }))) {
        throw conflict('This email is already in use.');
      }
      data.email = email;
    }
  }
  if (req.body.upiId !== undefined) data.upiId = str(req.body.upiId) || null;
  if (req.body.logoUrl !== undefined) {
    data.logoUrl = req.body.logoUrl ? await uploadBase64Image(String(req.body.logoUrl), 'clubs/logos') : null;
    if (club.logoUrl && club.logoUrl !== data.logoUrl) deleteImage(club.logoUrl).catch(() => {});
  }
  if (req.body.qrUrl !== undefined) {
    data.qrUrl = req.body.qrUrl ? await uploadBase64Image(String(req.body.qrUrl), 'clubs/qrs') : null;
    if (club.qrUrl && club.qrUrl !== data.qrUrl) deleteImage(club.qrUrl).catch(() => {});
  }

  const updated = await prisma.$transaction(async tx => {
    const u = await tx.club.update({ where: { id }, data });
    if (typeof data.email === 'string') await tx.profile.updateMany({ where: { clubId: id, email: club.email }, data: { email: data.email } });
    await audit(actor.id, 'UPDATE_CLUB', 'Club', id, { fields: Object.keys(data) }, tx);
    return u;
  });
  return res.status(200).json({ club: withoutPassword(updated) });
});

/** Archive hides the club and all its events from the public; nothing is deleted. */
router.post('/:id/archive', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw notFound('Club not found.');
  await prisma.club.update({ where: { id }, data: { isArchived: true } });
  await audit(actor.id, 'ARCHIVE_CLUB', 'Club', id, { name: club.name });
  return res.status(200).json({ message: `Club "${club.name}" archived.` });
});

router.post('/:id/restore', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw notFound('Club not found.');
  await prisma.club.update({ where: { id }, data: { isArchived: false } });
  await audit(actor.id, 'RESTORE_CLUB', 'Club', id, { name: club.name });
  return res.status(200).json({ message: `Club "${club.name}" restored.` });
});

/**
 * Permanently delete a club. Refused while the club has registrations, ledger
 * entries or orders (archive it instead) so financial history is never orphaned.
 */
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const id = str(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw notFound('Club not found.');
  if (str(req.body?.confirm) !== club.name) throw badRequest('To permanently delete, send { "confirm": "<exact club name>" }.');

  const [registrations, ledger, orders] = await Promise.all([
    prisma.registration.count({ where: { event: { clubId: id } } }),
    prisma.ledgerEntry.count({ where: { clubId: id } }),
    prisma.order.count({ where: { clubId: id } }),
  ]);
  if (registrations || ledger || orders) {
    throw conflict(
      `This club has ${registrations} registration(s), ${ledger} ledger entr${ledger === 1 ? 'y' : 'ies'} and ${orders} order(s). Archive it instead to preserve history.`
    );
  }

  await prisma.$transaction(async tx => {
    await tx.profile.updateMany({ where: { clubId: id }, data: { clubId: null, role: Role.STUDENT } });
    await tx.registrationKey.updateMany({ where: { usedByClubId: id }, data: { usedByClubId: null } });
    await tx.club.delete({ where: { id } });
    await audit(actor.id, 'DELETE_CLUB', 'Club', id, { name: club.name, email: club.email }, tx);
  });
  return res.status(200).json({ message: `Club "${club.name}" deleted.` });
});

// ─── Club Head assignment ─────────────────────────────────────────────────────

router.put('/:id/assign-head', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const clubId = str(req.params.id);
  const userId = str(req.body.userId);
  if (!userId) throw badRequest('userId is required.');

  const [club, user] = await Promise.all([prisma.club.findUnique({ where: { id: clubId } }), prisma.profile.findUnique({ where: { id: userId } })]);
  if (!club) throw notFound('Club not found.');
  if (!user) throw notFound('User not found.');
  if (club.isArchived) throw badRequest('Cannot assign a head to an archived club.');
  if (user.role === Role.SUPER_ADMIN) throw badRequest('A Super Admin cannot be a Club Head. Create a separate account.');
  if (!user.isActive) throw badRequest('Cannot assign a deactivated account.');

  await prisma.profile.update({ where: { id: userId }, data: { clubId, role: Role.CLUB_HEAD } });
  await audit(actor.id, 'ASSIGN_CLUB_HEAD', 'Club', clubId, { userId, previousClubId: user.clubId });
  return res.status(200).json({ message: `${user.fullName} assigned as Club Head for ${club.name}.` });
});

router.delete('/:id/heads/:userId', async (req: Request, res: Response): Promise<any> => {
  const actor = currentUser(req);
  const clubId = str(req.params.id);
  const userId = str(req.params.userId);
  const user = await prisma.profile.findFirst({ where: { id: userId, clubId, role: Role.CLUB_HEAD } });
  if (!user) throw notFound('That user is not a head of this club.');
  await prisma.profile.update({ where: { id: userId }, data: { clubId: null, role: Role.STUDENT } });
  await audit(actor.id, 'REMOVE_CLUB_HEAD', 'Club', clubId, { userId });
  return res.status(200).json({ message: `${user.fullName} is no longer a Club Head.` });
});

export default router;
