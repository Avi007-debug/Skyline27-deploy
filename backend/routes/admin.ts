import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { requireSuperAdmin, requireClubHead } from '../middlewares/authorizeRole';
import { generateRegistrationKey } from '../utils/crypto';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../utils/pagination';

// Express 5 types req.params values as string | string[] — helper to safely extract a string
const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v) ?? '';

const router = Router();

// All admin routes require authentication first
router.use(requireAuth);

// ─── Platform-wide Statistics ────────────────────────────────────────────────

router.get('/stats', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const [
      totalUsers,
      totalClubs,
      totalEvents,
      publishedEvents,
      totalRegistrations,
      confirmedRegistrations,
      pendingRegistrations,
      totalKeys,
      unusedKeys,
    ] = await Promise.all([
      prisma.profile.count({ where: { clubId: null } }),
      prisma.club.count(),
      prisma.event.count({ where: { isArchived: false } }),
      prisma.event.count({ where: { isPublished: true, isArchived: false } }),
      prisma.registration.count(),
      prisma.registration.count({ where: { status: 'CONFIRMED' } }),
      prisma.registration.count({ where: { status: 'PENDING' } }),
      prisma.registrationKey.count(),
      prisma.registrationKey.count({ where: { isUsed: false } }),
    ]);

    const now = new Date();
    const upcomingEvents = await prisma.event.count({
      where: {
        isPublished: true,
        isArchived: false,
        eventDate: { gte: now },
      },
    });

    // Revenue (sum of fees for CONFIRMED registrations)
    const confirmedWithFee = await prisma.registration.findMany({
      where: { status: 'CONFIRMED' },
      include: { event: { select: { fee: true } } },
    });
    const totalRevenue = confirmedWithFee.reduce((sum, r) => sum + (r.event?.fee ?? 0), 0);

    // Recent audit log entries
    const recentAuditLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });

    return res.status(200).json({
      stats: {
        totalUsers,
        totalClubs,
        totalEvents,
        publishedEvents,
        upcomingEvents,
        totalRegistrations,
        confirmedRegistrations,
        pendingRegistrations,
        totalRevenue,
        totalKeys,
        unusedKeys,
      },
      recentAuditLogs,
    });
  } catch (err: any) {
    console.error('[Admin] Stats error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const roleFilter = req.query.role ? String(req.query.role) : undefined;
    const { skip, take } = prismaSkipTake(params);

    const where: any = {};

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { usn: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (roleFilter) {
      where.role = roleFilter;
    }

    const [users, totalItems] = await Promise.all([
      prisma.profile.findMany({
        where,
        skip,
        take,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          usn: true,
          branch: true,
          phone: true,
          year: true,
          sem: true,
          role: true,
          clubId: true,
          club: { select: { id: true, name: true } },
        },
      }),
      prisma.profile.count({ where }),
    ]);

    return res.status(200).json(buildPaginatedResult(users, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await prisma.profile.findUnique({
      where: { id: p(req.params.id) },
      select: {
        id: true,
        fullName: true,
        email: true,
        usn: true,
        branch: true,
        phone: true,
        year: true,
        sem: true,
        role: true,
        clubId: true,
        club: { select: { id: true, name: true, email: true, logoUrl: true } },
        registrations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { event: { select: { id: true, name: true, eventDate: true } } },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update user role
router.put('/users/:id/role', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const role = String(req.body.role || '');
    const validRoles = ['STUDENT', 'MEMBER', 'VOLUNTEER', 'TREASURER', 'CLUB_HEAD', 'ADMIN', 'SUPER_ADMIN'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const user = await prisma.profile.update({
      where: { id: p(req.params.id) },
      data: { role: role as any },
      select: { id: true, fullName: true, email: true, role: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'UPDATE_USER_ROLE',
        entityType: 'Profile',
        entityId: p(req.params.id),
        details: JSON.stringify({ newRole: role }),
      },
    });

    return res.status(200).json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete user (SUPER_ADMIN only — dangerous, with safeguards)
router.delete('/users/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const targetId = String(req.params.id);
    const actorId = req.auth!.userId;

    // Prevent self-deletion
    if (targetId === actorId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const user = await prisma.profile.findUnique({
      where: { id: targetId },
      select: { id: true, fullName: true, email: true, role: true, clubId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Cannot delete another SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot delete a Super Admin account.' });
    }

    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'DELETE_USER',
        entityType: 'Profile',
        entityId: targetId,
        details: JSON.stringify({ deletedEmail: user.email, deletedName: user.fullName }),
      },
    });

    // Cascade delete handles registrations, expense claims, etc. via DB constraints
    await prisma.profile.delete({ where: { id: targetId } });

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    console.error('[Admin] Delete user error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update user details (SUPER_ADMIN only)
router.put('/users/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const targetId = String(req.params.id);
    const { fullName, email, usn, branch, phone, year, sem } = req.body;

    const existing = await prisma.profile.findUnique({ where: { id: targetId } });
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const updated = await prisma.profile.update({
      where: { id: targetId },
      data: {
        ...(fullName !== undefined && { fullName: fullName.trim() }),
        ...(email !== undefined && { email: email.toLowerCase().trim() }),
        ...(usn !== undefined && { usn: usn ? usn.trim() : null }),
        ...(branch !== undefined && { branch: branch ? branch.trim() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(year !== undefined && { year: year ? parseInt(year) : null }),
        ...(sem !== undefined && { sem: sem ? parseInt(sem) : null }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        usn: true,
        branch: true,
        phone: true,
        year: true,
        sem: true,
        role: true,
        clubId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'UPDATE_USER_DETAILS',
        entityType: 'Profile',
        entityId: targetId,
        details: JSON.stringify({ fullName, email, usn, branch }),
      },
    });

    return res.status(200).json({ user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Clubs ────────────────────────────────────────────────────────────────────

router.get('/clubs', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [clubs, totalItems] = await Promise.all([
      prisma.club.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          admins: { select: { id: true, fullName: true, email: true, role: true } },
          _count: { select: { events: true } },
        },
      }),
      prisma.club.count({ where }),
    ]);

    return res.status(200).json(buildPaginatedResult(clubs, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/clubs/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: p(req.params.id) },
      include: {
        admins: { select: { id: true, fullName: true, email: true, role: true } },
        events: {
          where: { isArchived: false },
          orderBy: { eventDate: 'desc' },
          take: 20,
          select: {
            id: true, name: true, eventDate: true, isPublished: true,
            _count: { select: { registrations: true } },
          },
        },
        _count: { select: { events: true } },
      },
    });

    if (!club) return res.status(404).json({ error: 'Club not found.' });

    // Strip password from response
    const { password: _pw, ...safeClub } = club as any;
    return res.status(200).json({ club: safeClub });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update club (SUPER_ADMIN only)
router.put('/clubs/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const clubId = p(req.params.id);
    const { name, email, logoUrl, qrUrl, upiId } = req.body;

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ error: 'Club not found.' });

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email.toLowerCase().trim() }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(qrUrl !== undefined && { qrUrl }),
        ...(upiId !== undefined && { upiId }),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'UPDATE_CLUB',
        entityType: 'Club',
        entityId: clubId,
        details: JSON.stringify({ name, email }),
      },
    });

    const { password: _, ...safe } = updated as any;
    return res.status(200).json({ club: safe });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete club (SUPER_ADMIN only — cascades events, unlinks members)
router.delete('/clubs/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const clubId = p(req.params.id);
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ error: 'Club not found.' });

    // 1. Unlink profiles belonging to this club (revert to STUDENT)
    await prisma.profile.updateMany({
      where: { clubId },
      data: { clubId: null, role: 'STUDENT' as any },
    });

    // 2. Unlink or remove registration keys associated with this club
    await prisma.registrationKey.deleteMany({
      where: { usedByClubId: clubId },
    });

    // 3. Delete club (Event, Team, Registration cascade automatically via foreign key constraints)
    await prisma.club.delete({ where: { id: clubId } });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'DELETE_CLUB',
        entityType: 'Club',
        entityId: clubId,
        details: JSON.stringify({ deletedClubName: club.name, deletedClubEmail: club.email }),
      },
    });

    return res.status(200).json({ message: `Club "${club.name}" and associated records deleted successfully.` });
  } catch (err: any) {
    console.error('[Admin] Delete club error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Events ───────────────────────────────────────────────────────────────────

router.get('/events', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);
    const clubFilter = req.query.clubId ? String(req.query.clubId) : undefined;
    const statusFilter = req.query.status ? String(req.query.status) : undefined;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { venue: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (clubFilter) where.clubId = clubFilter;
    if (statusFilter === 'published') where.isPublished = true;
    if (statusFilter === 'unpublished') where.isPublished = false;
    if (statusFilter === 'archived') where.isArchived = true;
    else if (!statusFilter) where.isArchived = false;

    const [events, totalItems] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { eventDate: 'desc' },
        include: {
          club: { select: { id: true, name: true, logoUrl: true } },
          _count: { select: { registrations: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    const mapped = events.map(e => ({
      id: e.id,
      name: e.name,
      title: e.name,
      description: e.description,
      venue: e.venue,
      eventDate: e.eventDate,
      eventEndDate: e.eventEndDate,
      registrationDeadline: e.registrationDeadline,
      fee: e.fee,
      registrationLimit: e.registrationLimit,
      isPublished: e.isPublished,
      isArchived: e.isArchived,
      registrationClosedManually: e.registrationClosedManually,
      bannerUrl: e.bannerUrl,
      club: e.club,
      registrationCount: e._count?.registrations ?? 0,
    }));

    return res.status(200).json(buildPaginatedResult(mapped, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update event (SUPER_ADMIN only)
router.put('/events/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const eventId = p(req.params.id);
    const {
      name, description, venue, eventDate, eventEndDate,
      registrationDeadline, fee, registrationLimit,
      isPublished, isArchived, registrationClosedManually,
    } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(venue !== undefined && { venue: venue.trim() }),
        ...(eventDate && { eventDate: new Date(eventDate) }),
        ...(eventEndDate !== undefined && { eventEndDate: eventEndDate ? new Date(eventEndDate) : null }),
        ...(registrationDeadline !== undefined && { registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null }),
        ...(fee !== undefined && { fee: parseFloat(fee) }),
        ...(registrationLimit !== undefined && { registrationLimit: parseInt(registrationLimit) }),
        ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
        ...(isArchived !== undefined && { isArchived: Boolean(isArchived) }),
        ...(registrationClosedManually !== undefined && { registrationClosedManually: Boolean(registrationClosedManually) }),
      } as any,
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'UPDATE_EVENT',
        entityType: 'Event',
        entityId: eventId,
        details: JSON.stringify({ name, isPublished, isArchived }),
      },
    });

    return res.status(200).json({ event: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Force Delete event (SUPER_ADMIN only)
router.delete('/events/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const eventId = p(req.params.id);
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    await prisma.event.delete({ where: { id: eventId } });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'DELETE_EVENT',
        entityType: 'Event',
        entityId: eventId,
        details: JSON.stringify({ deletedEventName: event.name }),
      },
    });

    return res.status(200).json({ message: `Event "${event.name}" permanently deleted.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Registrations ────────────────────────────────────────────────────────────

router.get('/registrations', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);
    const statusFilter = req.query.status ? String(req.query.status) : undefined;
    const eventFilter = req.query.eventId ? String(req.query.eventId) : undefined;

    const where: any = {};
    if (statusFilter) where.status = statusFilter;
    if (eventFilter) where.eventId = eventFilter;
    if (params.search) {
      where.OR = [
        { profile: { fullName: { contains: params.search, mode: 'insensitive' } } },
        { profile: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [registrations, totalItems] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { id: true, fullName: true, email: true, usn: true } },
          event: { select: { id: true, name: true, fee: true, club: { select: { name: true } } } },
          team: { select: { id: true, teamName: true } },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    return res.status(200).json(buildPaginatedResult(registrations, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update registration status (SUPER_ADMIN only)
router.put('/registrations/:id/status', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const regId = p(req.params.id);
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'REJECTED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const reg = await prisma.registration.findUnique({
      where: { id: regId },
      include: { profile: { select: { fullName: true, email: true } }, event: { select: { name: true } } },
    });
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });

    const updated = await prisma.registration.update({
      where: { id: regId },
      data: { status: status as any },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'UPDATE_REGISTRATION_STATUS',
        entityType: 'Registration',
        entityId: regId,
        details: JSON.stringify({ oldStatus: reg.status, newStatus: status, user: reg.profile?.email, event: reg.event?.name }),
      },
    });

    return res.status(200).json({ registration: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete registration (SUPER_ADMIN only)
router.delete('/registrations/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const regId = p(req.params.id);
    const reg = await prisma.registration.findUnique({
      where: { id: regId },
      include: { profile: { select: { fullName: true, email: true } }, event: { select: { name: true } } },
    });
    if (!reg) return res.status(404).json({ error: 'Registration not found.' });

    await prisma.registration.delete({ where: { id: regId } });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'DELETE_REGISTRATION',
        entityType: 'Registration',
        entityId: regId,
        details: JSON.stringify({ user: reg.profile?.email, event: reg.event?.name }),
      },
    });

    return res.status(200).json({ message: 'Registration deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get('/audit-logs', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);
    const entityFilter = req.query.entityType ? String(req.query.entityType) : undefined;

    const where: any = {};
    if (entityFilter) where.entityType = entityFilter;
    if (params.search) {
      where.OR = [
        { action: { contains: params.search, mode: 'insensitive' } },
        { entityType: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [logs, totalItems] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.status(200).json(buildPaginatedResult(logs, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Registration Keys ────────────────────────────────────────────────────────

router.get('/registration-keys', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const params = parsePaginationParams(req);
    const { skip, take } = prismaSkipTake(params);
    const usedFilter = req.query.isUsed ? String(req.query.isUsed) : undefined;

    const where: any = {};
    if (usedFilter === 'true') where.isUsed = true;
    if (usedFilter === 'false') where.isUsed = false;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { usedByClub: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [keys, totalItems] = await Promise.all([
      prisma.registrationKey.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          usedByClub: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.registrationKey.count({ where }),
    ]);

    return res.status(200).json(buildPaginatedResult(keys, totalItems, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/registration-keys/generate', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { customCode } = req.body;
    let codeToUse = '';

    if (customCode && typeof customCode === 'string' && customCode.trim()) {
      codeToUse = customCode.trim().toUpperCase();
      const existing = await prisma.registrationKey.findUnique({ where: { code: codeToUse } });
      if (existing) {
        return res.status(400).json({ error: 'This registration code already exists.' });
      }
    } else {
      codeToUse = generateRegistrationKey('SKYLINE');
    }

    const key = await prisma.registrationKey.create({
      data: { code: codeToUse },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'GENERATE_REGISTRATION_KEY',
        entityType: 'RegistrationKey',
        entityId: key.id,
        details: JSON.stringify({ code: key.code }),
      },
    });

    // Return the newly generated key explicitly — not just a list refresh
    return res.status(201).json({ key });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Deactivate/revoke a key
router.delete('/registration-keys/:id', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const key = await prisma.registrationKey.findUnique({ where: { id: p(req.params.id) } });
    if (!key) return res.status(404).json({ error: 'Key not found.' });
    if (key.isUsed) return res.status(400).json({ error: 'Cannot delete a key that has already been used.' });

    await prisma.registrationKey.delete({ where: { id: p(req.params.id) } });
    return res.status(200).json({ message: 'Registration key deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Club Head Assignment ──────────────────────────────────────────────────────

router.put('/clubs/:id/assign-head', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.body;
    const clubId = String(req.params.id);

    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ error: 'Club not found.' });

    const user = await prisma.profile.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Assign club + promote to CLUB_HEAD
    await prisma.profile.update({
      where: { id: userId },
      data: { clubId, role: 'CLUB_HEAD' as any },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'ASSIGN_CLUB_HEAD',
        entityType: 'Club',
        entityId: clubId,
        details: JSON.stringify({ userId, clubId }),
      },
    });

    return res.status(200).json({ message: `User ${user.fullName} assigned as Club Head for ${club.name}.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Database Maintenance & Utilities ──────────────────────────────────────────

// Prune expired reset tokens and unassigned stale keys
router.post('/db/clean-expired-tokens', requireSuperAdmin, async (req: Request, res: Response): Promise<any> => {
  try {
    const now = new Date();
    const result = await prisma.profile.updateMany({
      where: {
        passwordResetExpiry: { lt: now },
      },
      data: {
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.auth!.userId,
        action: 'DB_CLEANUP_EXPIRED_TOKENS',
        entityType: 'Profile',
        entityId: 'SYSTEM',
        details: JSON.stringify({ cleanedTokensCount: result.count }),
      },
    });

    return res.status(200).json({ message: `Cleaned ${result.count} expired reset tokens.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
