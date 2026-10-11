import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireUser, currentUser, isSuperAdmin } from '../../middlewares/authorize';
import { badRequest, notFound } from '../../middlewares/errorHandler';
import { str, optInt } from '../../utils/params';
import { studentStats, clubStats, platformStats } from './stats.service';
import { safeProfile } from './profile.mapper';

const router = Router();


async function statsFor(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true, clubId: true } });
  if (!profile) throw notFound('Profile not found.');
  if (profile.role === Role.SUPER_ADMIN) return { role: 'SUPER_ADMIN', ...(await platformStats()) };
  if (profile.role === Role.CLUB_HEAD && profile.clubId) return clubStats(profile.clubId);
  return studentStats(userId);
}

/** A user may read their own profile; a super admin may read anyone's. Others get 404. */
function assertSelfOrAdmin(req: Request): string {
  const user = currentUser(req);
  const id = str(req.params.id);
  if (id === 'me' || id === user.id) return user.id;
  if (isSuperAdmin(user)) return id;
  throw notFound('Profile not found');
}

// ─── Saved (bookmarked) events: stored per account so they follow the student across devices ───

router.get('/me/saved', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const rows = await prisma.savedEvent.findMany({ where: { userId: user.id }, select: { eventId: true }, orderBy: { createdAt: 'desc' } });
  return res.status(200).json({ eventIds: rows.map(r => r.eventId) });
});

/** Merge bookmarks made before signing in (stored in the browser) into the account. */
router.post('/me/saved/sync', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const ids = Array.isArray(req.body?.eventIds) ? [...new Set((req.body.eventIds as unknown[]).map(String))].slice(0, 500) : [];
  if (ids.length) {
    const existing = await prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true } });
    await prisma.savedEvent.createMany({ data: existing.map(e => ({ userId: user.id, eventId: e.id })), skipDuplicates: true });
  }
  const rows = await prisma.savedEvent.findMany({ where: { userId: user.id }, select: { eventId: true }, orderBy: { createdAt: 'desc' } });
  return res.status(200).json({ eventIds: rows.map(r => r.eventId) });
});

router.put('/me/saved/:eventId', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const eventId = str(req.params.eventId);
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound('Event not found.');
  await prisma.savedEvent.upsert({ where: { userId_eventId: { userId: user.id, eventId } }, create: { userId: user.id, eventId }, update: {} });
  return res.status(200).json({ saved: true });
});

router.delete('/me/saved/:eventId', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  await prisma.savedEvent.deleteMany({ where: { userId: user.id, eventId: str(req.params.eventId) } });
  return res.status(200).json({ saved: false });
});

router.get('/me', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, include: { club: { select: { id: true, name: true, logoUrl: true } } } });
  return res.status(200).json({ profile: safeProfile(profile) });
});

router.get('/:id/stats', requireUser, async (req: Request, res: Response): Promise<any> => {
  return res.status(200).json(await statsFor(assertSelfOrAdmin(req)));
});

router.get('/:id', requireUser, async (req: Request, res: Response): Promise<any> => {
  const profile = await prisma.profile.findUnique({ where: { id: assertSelfOrAdmin(req) } });
  if (!profile) throw notFound('Profile not found');
  return res.status(200).json({ profile: safeProfile(profile) });
});

/**
 * Update the caller's own permitted fields. Role, club, email and password are never
 * editable here. USN can be set once (it identifies the student to clubs).
 */
async function updateOwnProfile(req: Request, res: Response): Promise<any> {
  const user = currentUser(req);
  const current = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!current) throw notFound('Profile not found.');
  const b = req.body ?? {};
  const name = b.full_name ?? b.fullName ?? b.name;

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    const n = str(name);
    if (!n) throw badRequest('Name cannot be empty.');
    data.fullName = n.slice(0, 120);
  }
  for (const field of ['branch', 'phone'] as const) {
    if (b[field] !== undefined) data[field] = str(b[field]).slice(0, 60) || null;
  }
  if (data.phone && !/^[+0-9 ()-]{7,20}$/.test(String(data.phone))) throw badRequest('Phone number is not valid.');
  if (b.year !== undefined && b.year !== '') data.year = optInt(b.year, 'year', { min: 1, max: 6 });
  if (b.sem !== undefined && b.sem !== '') data.sem = optInt(b.sem, 'sem', { min: 1, max: 12 });

  const usn = str(b.usn);
  if (usn && !current.usn) {
    const taken = await prisma.profile.findUnique({ where: { usn } });
    if (taken && taken.id !== user.id) throw badRequest('This USN is already registered to another account.');
    data.usn = usn.slice(0, 30);
  }

  const profile = await prisma.profile.update({ where: { id: user.id }, data });
  return res.status(200).json({ message: 'Profile updated successfully', profile: safeProfile(profile) });
}

router.put('/edit', requireUser, updateOwnProfile);
router.put('/update', requireUser, updateOwnProfile);
router.put('/me', requireUser, updateOwnProfile);

export default router;
