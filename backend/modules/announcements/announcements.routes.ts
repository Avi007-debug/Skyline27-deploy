import { Router, Request, Response } from 'express';
import { AnnouncementCategory, Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireRole, requireClubManager, assertClubAccess, currentUser, resolveClubScope } from '../../middlewares/authorize';
import { notFound } from '../../middlewares/errorHandler';
import { buildPaginatedResult, parsePaginationParams, prismaSkipTake } from '../../utils/pagination';
import { oneOf, optStr, requiredStr, str } from '../../utils/params';
import { audit } from '../../utils/audit';

/**
 * Club announcements: one official feed per club instead of scattered chat groups. Anyone can read a
 * club's feed; only that club's head (or Super Admin) can post. Posting notifies every active member
 * with a single bulk insert.
 */
const router = Router();
const requireStudent = requireRole(Role.STUDENT);

const CATEGORIES = Object.values(AnnouncementCategory);

const announcementInclude = {
  author: { select: { id: true, fullName: true } },
  club: { select: { id: true, name: true, logoUrl: true } },
} satisfies Prisma.AnnouncementInclude;

/** Public timeline for one club, newest first. */
router.get('/club/:clubId', async (req: Request, res: Response): Promise<any> => {
  const club = await prisma.club.findUnique({ where: { id: str(req.params.clubId) }, select: { id: true, isArchived: true } });
  if (!club || club.isArchived) throw notFound('Club not found.');
  const category = oneOf(optStr(req.query.category), CATEGORIES, 'category');
  const params = parsePaginationParams(req, { pageSize: 20 });
  const { skip, take } = prismaSkipTake(params);
  const where: Prisma.AnnouncementWhereInput = { clubId: club.id, ...(category ? { category } : {}) };
  const [totalItems, items] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({ where, include: announcementInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

/** A student's combined feed from the clubs they are an active member of. */
router.get('/feed', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, status: 'ACTIVE', endDate: { gt: new Date() } },
    select: { clubId: true },
    distinct: ['clubId'],
  });
  const params = parsePaginationParams(req, { pageSize: 20 });
  const { skip, take } = prismaSkipTake(params);
  const where: Prisma.AnnouncementWhereInput = { clubId: { in: memberships.map(m => m.clubId) } };
  const [totalItems, items] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({ where, include: announcementInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

router.post('/club/:clubId', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const clubId = resolveClubScope(user, str(req.params.clubId));
  if (!clubId) throw notFound('Club not found.');
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, name: true, isArchived: true } });
  if (!club || club.isArchived) throw notFound('Club not found.');

  const title = requiredStr(req.body.title, 'Title', 140);
  const content = requiredStr(req.body.content, 'Message', 5000);
  const category = oneOf(optStr(req.body.category), CATEGORIES, 'category') ?? 'GENERAL';

  const announcement = await prisma.$transaction(async tx => {
    const created = await tx.announcement.create({ data: { clubId, authorId: user.id, title, content, category }, include: announcementInclude });
    const members = await tx.membership.findMany({
      where: { clubId, status: 'ACTIVE', endDate: { gt: new Date() } },
      select: { userId: true },
      distinct: ['userId'],
    });
    if (members.length > 0) {
      await tx.notification.createMany({
        data: members
          .filter(m => m.userId !== user.id)
          .map(m => ({ userId: m.userId, type: 'announcement', title: `${club.name}: ${title}`, body: content.length > 200 ? `${content.slice(0, 197)}...` : content })),
      });
    }
    await audit(user.id, 'CREATE_ANNOUNCEMENT', 'Announcement', created.id, { clubId, category, notified: members.length }, tx);
    return created;
  });
  return res.status(201).json({ announcement });
});

async function loadManaged(req: Request) {
  const user = currentUser(req);
  const announcement = await prisma.announcement.findUnique({ where: { id: str(req.params.id) } });
  if (!announcement) throw notFound('Announcement not found.');
  assertClubAccess(user, announcement.clubId);
  return { user, announcement };
}

router.put('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, announcement } = await loadManaged(req);
  const data: Prisma.AnnouncementUpdateInput = {};
  if (req.body.title !== undefined) data.title = requiredStr(req.body.title, 'Title', 140);
  if (req.body.content !== undefined) data.content = requiredStr(req.body.content, 'Message', 5000);
  if (req.body.category !== undefined) data.category = oneOf(optStr(req.body.category), CATEGORIES, 'category') ?? announcement.category;
  const updated = await prisma.announcement.update({ where: { id: announcement.id }, data, include: announcementInclude });
  await audit(user.id, 'UPDATE_ANNOUNCEMENT', 'Announcement', announcement.id, { fields: Object.keys(data) });
  return res.status(200).json({ announcement: updated });
});

router.delete('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, announcement } = await loadManaged(req);
  await prisma.announcement.delete({ where: { id: announcement.id } });
  await audit(user.id, 'DELETE_ANNOUNCEMENT', 'Announcement', announcement.id, { clubId: announcement.clubId, title: announcement.title });
  return res.status(200).json({ deleted: true });
});

export default router;
