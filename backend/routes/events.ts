import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { uploadBase64Image, deleteImage } from '../utils/storage';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../utils/pagination';

// Express 5 types req.params/query values as string | string[] — safe extractor
const p = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';

const router = Router();

/**
 * Server-side helper: determine whether registration is currently open for an event.
 * Registration is open when ALL of these are true:
 *   1. Event is published
 *   2. Not manually closed
 *   3. Not archived
 *   4. Registration deadline has not passed (if set)
 *   5. Event has not reached its registration limit
 */
async function isRegistrationOpen(event: any): Promise<boolean> {
  if (!event.isPublished) return false;
  if (event.isArchived) return false;
  if (event.registrationClosedManually) return false;
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) return false;

  if (event.registrationLimit) {
    const count = await prisma.registration.count({
      where: { eventId: event.id, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
    if (count >= event.registrationLimit) return false;
  }

  return true;
}

function mapEvent(e: any) {
  const normalizedType = e.eventType === 'Individual' ? 'Solo' : (e.eventType ?? 'Solo');
  return {
    id: e.id,
    title: e.name,
    name: e.name,
    venue: e.venue ?? 'TBD',
    image_url: e.bannerUrl ?? null,
    category: normalizedType,
    price: e.fee ?? 0,
    description: e.description ?? '',
    date: e.eventDate ? e.eventDate.toISOString() : null,
    eventDate: e.eventDate ? e.eventDate.toISOString() : null,
    eventEndDate: e.eventEndDate ? e.eventEndDate.toISOString() : null,
    eventType: normalizedType,
    teamSizeLimit: e.teamSizeLimit,
    minTeamSize: e.minTeamSize ?? null,
    registration_deadline: e.registrationDeadline ? e.registrationDeadline.toISOString() : null,
    registrationDeadline: e.registrationDeadline ? e.registrationDeadline.toISOString() : null,
    registration_limit: e.registrationLimit,
    registrationLimit: e.registrationLimit,
    isPublished: e.isPublished ?? true,
    isArchived: e.isArchived ?? false,
    registrationClosedManually: e.registrationClosedManually ?? false,
    club: e.club ? {
      id: e.club.id,
      name: e.club.name,
      logoUrl: e.club.logoUrl,
      logo_url: e.club.logoUrl,
      upiId: e.upiId ?? e.club.upiId,
    } : null,
    upiId: e.upiId ?? e.club?.upiId ?? null,
    qrUrl: e.qrUrl ?? (e.fee > 0 && e.club ? e.club.qrUrl : null),
    bannerUrl: e.bannerUrl ?? null,
    clubLogoUrl: e.club?.logoUrl ?? null,
    registrationCount: e._count?.registrations ?? 0,
  };
}

// ─── List events (public) — with pagination & search ─────────────────────────

router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);
  const clubFilter = req.query.clubId ? String(req.query.clubId) : undefined;

    // Public view: only published, non-archived events
    const where: any = { isPublished: true, isArchived: false };
    if (clubFilter) where.clubId = clubFilter;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { venue: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [events, totalItems] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          club: true,
          _count: { select: { registrations: true } },
        },
        orderBy: { eventDate: 'asc' },
        skip,
        take,
      }),
      prisma.event.count({ where }),
    ]);

    const mapped = events.map(mapEvent);

    // Support legacy format (no pagination) when no page param provided
    if (!req.query.page) {
      return res.status(200).json({ events: mapped });
    }

    return res.status(200).json(buildPaginatedResult(mapped, totalItems, params));
  } catch (error: any) {
    console.error('Events fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Single event (public) ────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const e = await prisma.event.findUnique({
      where: { id: id as string },
      include: {
        club: true,
        _count: { select: { registrations: true } },
      },
    });

    if (!e) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Don't expose archived events publicly
    if (e.isArchived && !req.query.includeArchived) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const registrationOpen = await isRegistrationOpen(e);
    const mapped = { ...mapEvent(e), registrationOpen };

    return res.status(200).json({ event: mapped });
  } catch (error: any) {
    console.error('Single event fetch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Create event (authenticated — club head) ─────────────────────────────────

router.post('/create', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.auth!.userId;
    const {
      name, description, venue, eventDate, eventEndDate, registrationDeadline,
      fee, registrationLimit, eventType, teamSizeLimit, minTeamSize,
      bannerUrl, qrUrl, upiId, isPublished,
    } = req.body;
    let { clubId } = req.body;

    if (!name) return res.status(400).json({ error: 'Event name is required.' });

    if (!clubId || clubId.trim() === '') {
      const profile = await prisma.profile.findUnique({ where: { id: userId } });
      if (profile?.clubId) {
        clubId = profile.clubId;
      } else {
        return res.status(400).json({ error: 'Your account is not linked to a club. Please complete club setup before creating events.' });
      }
    }

    // Authorization: must be club head of this club or SUPER_ADMIN
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== clubId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to create events for this club.' });
    }

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      return res.status(404).json({ error: 'Club not found.' });
    }

    const parsedFee = fee ? parseFloat(fee) : 0;
    const finalBannerUrl = bannerUrl ? await uploadBase64Image(bannerUrl, 'events/banners') : null;
    let finalQrUrl = qrUrl || null;
    if (finalQrUrl) {
      finalQrUrl = await uploadBase64Image(finalQrUrl, 'events/qrs');
    }

    const startDate = eventDate ? new Date(eventDate) : new Date();
    const defaultEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999);
    const finalEndDate = eventEndDate ? new Date(eventEndDate) : defaultEndDate;
    const finalDeadline = registrationDeadline ? new Date(registrationDeadline) : null;

    const event = await prisma.event.create({
      data: {
        name,
        description: description || '',
        venue: venue || 'TBD',
        eventType: eventType || 'Solo',
        teamSizeLimit: eventType === 'Team' && teamSizeLimit ? parseInt(teamSizeLimit) : null,
        minTeamSize: eventType === 'Team' && minTeamSize !== undefined && minTeamSize !== null
          ? Math.max(1, parseInt(minTeamSize))
          : (eventType === 'Team' ? 1 : null),
        fee: parsedFee,
        registrationLimit: registrationLimit ? Math.max(2, parseInt(registrationLimit)) : 100,
        registrationDeadline: finalDeadline,
        eventDate: startDate,
        eventEndDate: finalEndDate,
        clubId,
        bannerUrl: finalBannerUrl,
        qrUrl: finalQrUrl,
        upiId: upiId || null,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      } as any,
      include: { club: true },
    });

    return res.status(201).json({ event });
  } catch (error: any) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Update event (no longer requires password — uses session auth) ───────────

router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const {
      name, description, eventDate, eventEndDate, registrationDeadline,
      venue, registrationLimit, teamSizeLimit, minTeamSize, bannerUrl,
      upiId, qrUrl, fee, eventType, isPublished,
    } = req.body;

    const userId = req.auth!.userId;
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const existingEvent = await prisma.event.findUnique({
      where: { id: id as string },
      include: { club: true },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Authorization check (no password required — JWT session is sufficient)
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== existingEvent.clubId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this event.' });
    }

    let finalBannerUrl = existingEvent.bannerUrl;
    if (bannerUrl !== undefined) {
      if (bannerUrl && typeof bannerUrl === 'string' && bannerUrl.startsWith('data:image/')) {
        finalBannerUrl = await uploadBase64Image(bannerUrl, 'events/banners');
        if (existingEvent.bannerUrl && existingEvent.bannerUrl !== finalBannerUrl) {
          deleteImage(existingEvent.bannerUrl).catch(err =>
            console.error('[Storage] Error deleting old banner:', err)
          );
        }
      } else if (!bannerUrl) {
        finalBannerUrl = null;
        if (existingEvent.bannerUrl) {
          deleteImage(existingEvent.bannerUrl).catch(err =>
            console.error('[Storage] Error deleting old banner:', err)
          );
        }
      } else {
        finalBannerUrl = bannerUrl;
      }
    }

    const updatedEvent = await prisma.event.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(eventDate && { eventDate: new Date(eventDate) }),
        ...(eventEndDate && { eventEndDate: new Date(eventEndDate) }),
        ...(registrationDeadline !== undefined && {
          registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        }),
        ...(venue !== undefined && { venue }),
        ...(registrationLimit !== undefined && { registrationLimit: parseInt(registrationLimit) }),
        ...(teamSizeLimit !== undefined && { teamSizeLimit: parseInt(teamSizeLimit) }),
        ...(minTeamSize !== undefined && { minTeamSize: Math.max(1, parseInt(minTeamSize)) }),
        ...(fee !== undefined && { fee: parseFloat(fee) }),
        ...(eventType !== undefined && { eventType }),
        ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        bannerUrl: finalBannerUrl,
      } as any,
      include: { club: true },
    });

    return res.status(200).json({ event: updatedEvent });
  } catch (error: any) {
    console.error('Update event error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Close registration manually ──────────────────────────────────────────────

router.post('/:id/close-registration', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = p(req.params.id);
    const userId = req.auth!.userId;

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== event.clubId)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { registrationClosedManually: true } as any,
    });

    return res.status(200).json({ event: updated, message: 'Registration closed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Reopen registration ──────────────────────────────────────────────────────

router.post('/:id/reopen-registration', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = p(req.params.id);
    const userId = req.auth!.userId;

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== event.clubId)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { registrationClosedManually: false } as any,
    });

    return res.status(200).json({ event: updated, message: 'Registration reopened.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Delete / archive event ───────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = p(req.params.id);
    const userId = req.auth!.userId;
    const forceDelete = p(req.query.force as any) === 'true';

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== event.clubId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this event.' });
    }

    const hasRegistrations = ((event as any)._count?.registrations ?? 0) > 0;

    if (hasRegistrations && !forceDelete) {
      // Soft-delete: archive instead of hard delete (preserve registration history)
      await prisma.event.update({
        where: { id: p(req.params.id) || id },
        data: { isArchived: true, isPublished: false } as any,
      });
      return res.status(200).json({
        archived: true,
        message: 'Event archived (has existing registrations — use ?force=true to hard delete).',
      });
    }

    // Hard delete (no registrations, or force flag + SUPER_ADMIN)
    if (forceDelete && !isSuperAdmin) {
      return res.status(403).json({ error: 'Force deletion requires Super Admin privileges.' });
    }

    // Clean up banner image
    if (event.bannerUrl) {
      deleteImage(event.bannerUrl).catch(err => console.error('[Storage] Banner delete failed:', err));
    }

    await prisma.event.delete({ where: { id } });
    return res.status(200).json({ deleted: true, message: 'Event deleted permanently.' });
  } catch (err: any) {
    console.error('Delete event error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Get registrations for an event ──────────────────────────────────────────

router.get('/:id/registrations', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const userId = req.auth!.userId;
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== event.clubId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view registrations for this event.' });
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: id },
      include: { profile: true, team: true, event: true },
      orderBy: { createdAt: 'desc' },
    });

    const teamIdsWithPayment = new Set(
      registrations
        .filter(r => r.teamId && r.transactionId !== null)
        .map(r => r.teamId)
    );

    const confirmedTeamIds = new Set(
      registrations
        .filter(r => r.teamId && r.status === 'CONFIRMED')
        .map(r => r.teamId)
    );

    const filteredRegistrations = registrations.filter(r => {
      if (r.event.fee === 0) return true;
      if (r.status === 'CONFIRMED' || r.status === 'REJECTED') return true;
      if (r.transactionId !== null) return true;
      if (r.teamId && teamIdsWithPayment.has(r.teamId)) return true;
      if (r.teamId && confirmedTeamIds.has(r.teamId)) return true;
      return false;
    });

    const mapped = filteredRegistrations.map(r => ({
      id: r.id,
      status: r.status,
      checkedInAt: (r as any).checkedInAt,
      payment_proof_url: r.paymentProofUrl,
      transaction_id: r.transactionId,
      created_at: r.createdAt,
      user: r.profile ? {
        id: r.profile.id,
        name: r.profile.fullName,
        email: r.profile.email,
        usn: r.profile.usn,
        branch: r.profile.branch,
        phone: r.profile.phone,
        year: r.profile.year,
        sem: r.profile.sem,
      } : null,
      team: r.team ? {
        id: r.team.id,
        name: r.team.teamName,
        passkey: r.team.passkey,
        leaderId: r.team.leaderId,
      } : null,
    }));

    return res.status(200).json({ registrations: mapped });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── Update registration deadline ─────────────────────────────────────────────

router.put('/:id/deadline', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { registrationDeadline } = req.body;

    const userId = req.auth!.userId;
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({ where: { id: id as string } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!profile?.clubId || profile.clubId !== event.clubId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to update this event.' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: id as string },
      data: {
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      } as any,
      include: { club: true },
    });

    return res.status(200).json({ event: updatedEvent });
  } catch (error: any) {
    console.error('Update event deadline error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
