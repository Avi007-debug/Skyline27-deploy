import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { optionalAuth } from '../../middlewares/authenticate';
import { requireClubManager, assertClubAccess, currentUser } from '../../middlewares/authorize';
import { authLimiter } from '../../middlewares/rateLimit';
import { badRequest, conflict, forbidden, notFound } from '../../middlewares/errorHandler';
import { uploadBase64Image, deleteImage } from '../../utils/storage';
import { str } from '../../utils/params';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake, searchAny } from '../../utils/pagination';
import { audit } from '../../utils/audit';
import { validateEmail, validatePassword, SALT_ROUNDS } from '../auth/auth.service';
import { claimRegistrationKey, isKeyUsable } from './clubs.service';
import { clubDashboard } from './dashboard.service';

const router = Router();

const clubSelect = { id: true, name: true, email: true, logoUrl: true, upiId: true, qrUrl: true, isArchived: true, membershipFeePaise: true, membershipMonths: true } satisfies Prisma.ClubSelect;

// ─── Public: club directory ───────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const legacy = req.query.page === undefined;
  const params = parsePaginationParams(req, { pageSize: legacy ? 100 : undefined });
  const { skip, take } = prismaSkipTake(params);
  const where: Prisma.ClubWhereInput = { isArchived: false, ...(searchAny(params.search, ['name']) ?? {}) };

  const [totalItems, clubs] = await Promise.all([
    prisma.club.count({ where }),
    prisma.club.findMany({ where, select: { ...clubSelect, admins: { select: { id: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take }),
  ]);
  const items = clubs.map(c => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl ?? null,
    logo_url: c.logoUrl ?? null,
    upiId: c.upiId ?? null,
    qrUrl: c.qrUrl ?? null,
    membershipFeePaise: c.membershipFeePaise,
    membershipMonths: c.membershipMonths,
    adminIds: c.admins.map(a => a.id),
  }));
  return res.status(200).json({ ...buildPaginatedResult(items, totalItems, params), clubs: items });
});

// ─── Public onboarding helpers ────────────────────────────────────────────────

/** Is this registration key currently redeemable? (rate limited: keys are the gate to club creation) */
router.post('/verify-key', authLimiter, async (req: Request, res: Response): Promise<any> => {
  const key = str(req.body.key).toUpperCase();
  if (!key) throw badRequest('Registration key is required.');
  const record = await prisma.registrationKey.findUnique({ where: { code: key } });
  if (!record || !isKeyUsable(record)) {
    throw badRequest('Invalid or expired registration key. Please contact SkylineOS admins for an authorization code.');
  }
  return res.status(200).json({ valid: true, message: 'Authorization key verified successfully.' });
});

router.post('/check-email', authLimiter, async (req: Request, res: Response): Promise<any> => {
  const email = validateEmail(req.body.email);
  const [profile, club] = await Promise.all([prisma.profile.findUnique({ where: { email }, select: { id: true } }), prisma.club.findUnique({ where: { email }, select: { id: true } })]);
  if (profile || club) return res.status(400).json({ exists: true, error: 'This email address is already registered.' });
  return res.status(200).json({ exists: false, message: 'Email is available.' });
});

// ─── Create a club with a registration key ────────────────────────────────────

router.post('/', optionalAuth, authLimiter, async (req: Request, res: Response): Promise<any> => {
  const name = str(req.body.name);
  if (!name) throw badRequest('Club name is required.');
  const email = validateEmail(req.body.email);
  const registrationKey = str(req.body.registrationKey);
  if (!registrationKey) throw badRequest('Registration key is required to register a club.');
  const password = req.body.password ? validatePassword(req.body.password) : null;

  const key = await prisma.registrationKey.findUnique({ where: { code: registrationKey.toUpperCase() } });
  if (!key || !isKeyUsable(key)) {
    throw badRequest('Invalid or expired registration key. Please enter a valid key provided by SkylineOS admins.');
  }
  if (await prisma.club.findUnique({ where: { email } })) throw conflict('A club with this email already exists.');

  const caller = req.user;
  if (caller?.role === Role.SUPER_ADMIN) throw forbidden('Super admins create clubs from the admin console.');
  if (caller?.clubId) throw conflict('Your account already manages a club.');
  const existingProfile = await prisma.profile.findUnique({ where: { email } });
  if (existingProfile && existingProfile.id !== caller?.id) throw conflict('This email is already registered to another account.');

  const logoUrl = req.body.logoUrl ? await uploadBase64Image(String(req.body.logoUrl), 'clubs/logos') : null;
  const hashed = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

  const club = await prisma.$transaction(async tx => {
    const created = await tx.club.create({ data: { name: name.slice(0, 120), email, logoUrl, password: hashed } });
    await claimRegistrationKey(tx, registrationKey, created.id);
    if (caller) {
      await tx.profile.update({ where: { id: caller.id }, data: { clubId: created.id, role: Role.CLUB_HEAD } });
    } else {
      await tx.profile.create({
        data: { id: `user_${crypto.randomBytes(6).toString('hex')}`, fullName: `${name} Admin`.slice(0, 120), email, password: hashed, clubId: created.id, role: Role.CLUB_HEAD },
      });
    }
    await audit(caller?.id ?? null, 'CREATE_CLUB', 'Club', created.id, { name, via: 'registration_key' }, tx);
    return created;
  });

  const { password: _pw, ...safe } = club as any;
  return res.status(201).json({ club: safe });
});

// ─── Club Head: own club ──────────────────────────────────────────────────────

router.put('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const id = str(req.params.id);
  assertClubAccess(user, id);

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
      const taken = (await prisma.club.findUnique({ where: { email } })) || (await prisma.profile.findFirst({ where: { email, NOT: { clubId: id } } }));
      if (taken) throw conflict('This email is already in use.');
      data.email = email;
    }
  }
  if (req.body.upiId !== undefined) data.upiId = str(req.body.upiId) || null;
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
    if (typeof data.email === 'string') await tx.profile.updateMany({ where: { clubId: id, role: Role.CLUB_HEAD, email: club.email }, data: { email: data.email } });
    await audit(user.id, 'UPDATE_CLUB', 'Club', id, { fields: Object.keys(data) }, tx);
    return u;
  });
  const { password: _pw, ...safe } = updated as any;
  return res.status(200).json({ club: safe });
});

router.get('/:id/dashboard-stats', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const id = str(req.params.id);
  assertClubAccess(currentUser(req), id);
  return res.status(200).json(await clubDashboard(id));
});

export default router;
