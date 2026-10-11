import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { optionalAuth } from '../../middlewares/authenticate';
import { requireClubManager, assertClubAccess, canManageClub, currentUser, isSuperAdmin, resolveClubScope } from '../../middlewares/authorize';
import { badRequest, notFound, forbidden } from '../../middlewares/errorHandler';
import { uploadBase64Image, deleteImage } from '../../utils/storage';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake, searchAny } from '../../utils/pagination';
import { str, optStr, optBool } from '../../utils/params';
import { audit } from '../../utils/audit';
import { campusNow } from '../../utils/time';
import {
  PUBLIC_EVENT_WHERE,
  activeCounts,
  toPublicEvent,
  toManagedEvent,
  timeFilter,
  typeFilter,
} from './events.service';
import { parseEventInput } from './events.validation';
import { listEventRegistrations } from '../registrations/registrations.service';
import { eventPrice, isActiveMember, memberClubIds } from '../memberships/membership.service';

const router = Router();

const EVENT_SEARCH_FIELDS = ['name', 'description', 'venue', 'club.name'];

async function loadEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id }, include: { club: true } });
  if (!event) throw notFound('Event not found.');
  return event;
}

/** Load an event and require that the caller manages its club. */
async function loadManagedEvent(req: Request) {
  const user = currentUser(req);
  const event = await loadEvent(str(req.params.id));
  assertClubAccess(user, event.clubId);
  return { user, event };
}

// ─── Public: list published events (search, filters, pagination) ──────────────

router.get('/', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  // Legacy clients (Flutter, web_app) call without `page` and expect every event;
  // they get the first 100 so the response stays bounded.
  const legacy = req.query.page === undefined;
  const params = parsePaginationParams(req, { pageSize: legacy ? 100 : undefined });
  const { skip, take } = prismaSkipTake(params);
  const clubId = optStr(req.query.clubId);
  const status = optStr(req.query.status);

  const where: Prisma.EventWhereInput = {
    AND: [
      PUBLIC_EVENT_WHERE,
      clubId ? { clubId } : {},
      searchAny(params.search, EVENT_SEARCH_FIELDS) ?? {},
      timeFilter(status) ?? {},
      typeFilter(optStr(req.query.type)) ?? {},
    ],
  };
  const orderBy: Prisma.EventOrderByWithRelationInput[] =
    status === 'past' ? [{ eventDate: 'desc' }, { id: 'asc' }] : [{ eventDate: 'asc' }, { id: 'asc' }];

  const [totalItems, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({ where, include: { club: true }, orderBy, skip, take }),
  ]);
  const counts = await activeCounts(events.map(e => e.id));
  const now = campusNow();
  // Signed-in students see their own price (member price at clubs they belong to).
  const memberOf = req.user ? await memberClubIds(req.user.id, events.map(e => e.clubId)) : new Set<string>();
  const items = events.map(e => ({
    ...toPublicEvent(e, counts.get(e.id) ?? 0, now),
    isMember: memberOf.has(e.clubId),
    yourFee: eventPrice(e, memberOf.has(e.clubId)),
  }));

  return res.status(200).json({ ...buildPaginatedResult(items, totalItems, params), events: items });
});

// ─── Club Head / Super Admin: managed event list ──────────────────────────────

router.get('/manage/list', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const clubId = resolveClubScope(user, optStr(req.query.clubId));
  const visibility = optStr(req.query.visibility); // published | unpublished | archived | all

  const where: Prisma.EventWhereInput = {
    AND: [
      clubId ? { clubId } : {},
      visibility === 'archived'
        ? { isArchived: true }
        : visibility === 'all'
          ? {}
          : { isArchived: false, ...(visibility === 'published' ? { isPublished: true } : visibility === 'unpublished' ? { isPublished: false } : {}) },
      searchAny(params.search, EVENT_SEARCH_FIELDS) ?? {},
      timeFilter(optStr(req.query.status)) ?? {},
    ],
  };

  const [totalItems, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({ where, include: { club: true }, orderBy: [{ eventDate: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  const ids = events.map(e => e.id);
  const [counts, byStatus] = await Promise.all([
    activeCounts(ids),
    prisma.registration.groupBy({ by: ['eventId', 'status'], where: { eventId: { in: ids } }, _count: { _all: true } }),
  ]);
  const now = campusNow();
  const items = events.map(e => {
    const stats = { PENDING: 0, CONFIRMED: 0, REJECTED: 0 } as Record<string, number>;
    for (const g of byStatus) if (g.eventId === e.id) stats[g.status] = g._count._all;
    return { ...toManagedEvent(e, counts.get(e.id) ?? 0, now), registrationStats: stats };
  });
  return res.status(200).json(buildPaginatedResult(items, totalItems, params));
});

// ─── Public: single event ─────────────────────────────────────────────────────

router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  const event = await loadEvent(str(req.params.id));
  const manager = canManageClub(req.user, event.clubId) && !!req.user;
  const isPublic = event.isPublished && !event.isArchived && !event.club.isArchived;
  if (!isPublic && !manager) throw notFound('Event not found');

  const counts = await activeCounts([event.id]);
  const count = counts.get(event.id) ?? 0;
  if (!manager) {
    const pub = toPublicEvent(event, count);
    const member = req.user ? await isActiveMember(req.user.id, event.clubId) : false;
    return res.status(200).json({ event: { ...pub, isMember: member, yourFee: eventPrice(event, member) } });
  }

  const groups = await prisma.registration.groupBy({ by: ['status'], where: { eventId: event.id }, _count: { _all: true } });
  const registrationStats = { PENDING: 0, CONFIRMED: 0, REJECTED: 0 } as Record<string, number>;
  for (const g of groups) registrationStats[g.status] = g._count._all;
  return res.status(200).json({ event: { ...toManagedEvent(event, count), registrationStats } });
});

// ─── Create ───────────────────────────────────────────────────────────────────

async function createEvent(req: Request, res: Response): Promise<any> {
  const user = currentUser(req);
  const clubId = isSuperAdmin(user) ? str(req.body.clubId) : user.clubId!;
  if (!clubId) throw badRequest('clubId is required.');
  assertClubAccess(user, clubId);

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw notFound('Club not found.');
  if (club.isArchived) throw badRequest('Cannot create events for an archived club.');

  const input = parseEventInput(req.body);
  const bannerUrl = req.body.bannerUrl ? await uploadBase64Image(String(req.body.bannerUrl), 'events/banners') : null;
  const qrUrl = req.body.qrUrl ? await uploadBase64Image(String(req.body.qrUrl), 'events/qrs') : null;

  const start = input.eventDate!;
  const defaultEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);

  const event = await prisma.event.create({
    data: {
      clubId,
      name: input.name!,
      description: input.description ?? '',
      venue: input.venue ?? 'TBD',
      eventType: input.eventType ?? 'Solo',
      fee: input.fee ?? 0,
      memberFee: input.memberFee ?? null,
      registrationLimit: input.registrationLimit ?? 100,
      teamSizeLimit: input.teamSizeLimit ?? null,
      minTeamSize: input.minTeamSize ?? null,
      eventDate: start,
      eventEndDate: input.eventEndDate ?? defaultEnd,
      registrationOpensAt: input.registrationOpensAt ?? null,
      registrationDeadline: input.registrationDeadline ?? null,
      upiId: input.upiId ?? null,
      isPublished: input.isPublished ?? true,
      bannerUrl,
      qrUrl,
    },
    include: { club: true },
  });

  await audit(user.id, 'CREATE_EVENT', 'Event', event.id, { name: event.name, clubId });
  return res.status(201).json({ event: toManagedEvent(event, 0) });
}

router.post('/', requireClubManager, createEvent);
router.post('/create', requireClubManager, createEvent); // legacy path used by the club dashboard

// ─── Update (session auth only — no password re-entry) ────────────────────────

router.put('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, event } = await loadManagedEvent(req);
  const input = parseEventInput(req.body, event);

  if (input.registrationLimit !== undefined) {
    const active = (await activeCounts([event.id])).get(event.id) ?? 0;
    if (input.registrationLimit < active) {
      throw badRequest(`Capacity cannot be lower than the ${active} existing active registrations.`);
    }
  }
  if (input.fee !== undefined && input.fee !== event.fee) {
    const paid = await prisma.registration.count({ where: { eventId: event.id, OR: [{ status: 'CONFIRMED' }, { transactionId: { not: null } }] } });
    if (paid > 0 && event.fee > 0) throw badRequest('The fee cannot be changed after payments have been submitted.');
  }

  let bannerUrl = event.bannerUrl;
  if (req.body.bannerUrl !== undefined) {
    const incoming = req.body.bannerUrl ? String(req.body.bannerUrl) : '';
    bannerUrl = incoming ? await uploadBase64Image(incoming, 'events/banners') : null;
    if (event.bannerUrl && event.bannerUrl !== bannerUrl) deleteImage(event.bannerUrl).catch(() => {});
  }
  let qrUrl = event.qrUrl;
  if (req.body.qrUrl !== undefined) {
    const incoming = req.body.qrUrl ? String(req.body.qrUrl) : '';
    qrUrl = incoming ? await uploadBase64Image(incoming, 'events/qrs') : null;
    if (event.qrUrl && event.qrUrl !== qrUrl) deleteImage(event.qrUrl).catch(() => {});
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { ...input, bannerUrl, qrUrl },
    include: { club: true },
  });
  await audit(user.id, 'UPDATE_EVENT', 'Event', event.id, { fields: Object.keys(input) });

  const count = (await activeCounts([event.id])).get(event.id) ?? 0;
  return res.status(200).json({ event: toManagedEvent(updated, count) });
});

// Legacy: update only the (optional) registration deadline
router.put('/:id/deadline', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, event } = await loadManagedEvent(req);
  const input = parseEventInput({ registrationDeadline: req.body.registrationDeadline ?? null }, event);
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { registrationDeadline: input.registrationDeadline ?? null },
    include: { club: true },
  });
  await audit(user.id, 'UPDATE_EVENT_DEADLINE', 'Event', event.id, { registrationDeadline: updated.registrationDeadline });
  return res.status(200).json({ event: toManagedEvent(updated, (await activeCounts([event.id])).get(event.id) ?? 0) });
});

// ─── Lifecycle transitions ────────────────────────────────────────────────────

const transitions: Record<string, { data: Prisma.EventUpdateInput; action: string; message: string }> = {
  publish: { data: { isPublished: true }, action: 'PUBLISH_EVENT', message: 'Event published.' },
  unpublish: { data: { isPublished: false }, action: 'UNPUBLISH_EVENT', message: 'Event unpublished.' },
  'close-registration': { data: { registrationClosedManually: true }, action: 'CLOSE_REGISTRATION', message: 'Registration closed.' },
  'reopen-registration': { data: { registrationClosedManually: false }, action: 'REOPEN_REGISTRATION', message: 'Registration reopened.' },
  archive: { data: { isArchived: true, isPublished: false }, action: 'ARCHIVE_EVENT', message: 'Event archived.' },
  restore: { data: { isArchived: false }, action: 'RESTORE_EVENT', message: 'Event restored (unpublished). Publish it to make it public again.' },
};

for (const [path, t] of Object.entries(transitions)) {
  router.post(`/:id/${path}`, requireClubManager, async (req: Request, res: Response): Promise<any> => {
    const { user, event } = await loadManagedEvent(req);
    if (path === 'publish' && event.isArchived) throw badRequest('Restore the event before publishing it.');
    if (path === 'reopen-registration' && event.isArchived) throw badRequest('Archived events cannot accept registrations.');
    const updated = await prisma.event.update({ where: { id: event.id }, data: t.data, include: { club: true } });
    await audit(user.id, t.action, 'Event', event.id, { name: event.name });
    const count = (await activeCounts([event.id])).get(event.id) ?? 0;
    return res.status(200).json({ event: toManagedEvent(updated, count), message: t.message });
  });
}

// ─── Delete (archives when history exists) ────────────────────────────────────

router.delete('/:id', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, event } = await loadManagedEvent(req);
  const force = optBool(req.query.force) === true;

  const [registrations, ledgerRefs] = await Promise.all([
    prisma.registration.count({ where: { eventId: event.id } }),
    prisma.ledgerEntry.count({ where: { eventId: event.id } }),
  ]);
  const hasHistory = registrations > 0 || ledgerRefs > 0;

  if (hasHistory && !force) {
    await prisma.event.update({ where: { id: event.id }, data: { isArchived: true, isPublished: false } });
    await audit(user.id, 'ARCHIVE_EVENT', 'Event', event.id, { name: event.name, registrations, reason: 'delete-with-history' });
    return res.status(200).json({
      archived: true,
      message: `Event archived instead of deleted because it has ${registrations} registration(s). Its history is preserved.`,
    });
  }

  if (force) {
    if (!isSuperAdmin(user)) throw forbidden('Permanent deletion of an event with registrations requires Super Admin.');
    if (str(req.body?.confirm) !== event.name) {
      throw badRequest('To permanently delete, send { "confirm": "<exact event name>" }.');
    }
  }

  // Ledger entries have no foreign key to Event, so financial history survives a hard delete.
  await prisma.event.delete({ where: { id: event.id } });
  if (event.bannerUrl) deleteImage(event.bannerUrl).catch(() => {});
  await audit(user.id, 'DELETE_EVENT', 'Event', event.id, { name: event.name, clubId: event.clubId, registrations, force });
  return res.status(200).json({ deleted: true, message: 'Event deleted permanently.' });
});

// ─── Registrations for an event (club head of the event's club / super admin) ─

router.get('/:id/registrations', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { event } = await loadManagedEvent(req);
  const registrations = await listEventRegistrations(event.id);
  if (req.query.page === undefined) return res.status(200).json({ registrations });

  const params = parsePaginationParams(req);
  const status = optStr(req.query.status)?.toUpperCase();
  const q = params.search?.toLowerCase();
  const filtered = registrations.filter(
    r =>
      (!status || r.status === status) &&
      (!q || [r.user?.name, r.user?.email, r.user?.usn, r.team?.name].some(v => v?.toLowerCase().includes(q)))
  );
  const { skip, take } = prismaSkipTake(params);
  return res.status(200).json(buildPaginatedResult(filtered.slice(skip, skip + take), filtered.length, params));
});

export default router;
