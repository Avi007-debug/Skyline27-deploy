import { Router, Request, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { requireRole, requireClubManager, requireUser, assertClubAccess, currentUser } from '../../middlewares/authorize';
import { badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { deleteImage } from '../../utils/storage';
import { parsePaginationParams, buildPaginatedResult, prismaSkipTake } from '../../utils/pagination';
import { str, optStr, requiredStr } from '../../utils/params';
import { audit } from '../../utils/audit';
import { campusNow } from '../../utils/time';
import { postLedger } from '../finance/ledger.service';
import { PUBLIC_EVENT_WHERE } from '../events/events.service';
import { registerSolo, createTeam, joinTeam, generateUniquePasskey, toPaise } from './registrations.service';
import { activeMemberIds, GUEST_BADGE, MEMBER_BADGE } from '../memberships/membership.service';

/** Mounted at the API root: paths below are the historical public contract. */
const router = Router();

const requireStudent = requireRole(Role.STUDENT);

// ─── Student: ticket wallet ───────────────────────────────────────────────────

function toTicket(r: any) {
  const members = (() => {
    if (!r.team?.registrations) return [];
    const confirmedOnly = r.status === 'CONFIRMED';
    const seen = new Set<string>();
    return r.team.registrations
      .filter((reg: any) => reg.profile && reg.status !== 'REJECTED' && (!confirmedOnly || reg.status === 'CONFIRMED'))
      .sort((a: any, b: any) => {
        const al = a.profile.id === r.team.leaderId, bl = b.profile.id === r.team.leaderId;
        if (al !== bl) return al ? -1 : 1;
        if ((a.status === 'CONFIRMED') !== (b.status === 'CONFIRMED')) return a.status === 'CONFIRMED' ? -1 : 1;
        return 0;
      })
      .filter((reg: any) => (seen.has(reg.profile.id) ? false : (seen.add(reg.profile.id), true)))
      .map((reg: any) => ({ id: reg.profile.id, name: reg.profile.fullName, isLeader: reg.profile.id === r.team.leaderId, status: reg.status }));
  })();

  const e = r.event;
  return {
    id: r.id,
    status: r.status,
    payment_proof_url: r.paymentProofUrl,
    transaction_id: r.transactionId,
    created_at: r.createdAt,
    checkedInAt: r.checkedInAt,
    team: r.team ? { id: r.team.id, name: r.team.teamName, passkey: r.team.passkey, leaderId: r.team.leaderId, members } : null,
    event: e
      ? {
          id: e.id,
          title: e.name,
          venue: e.venue ?? 'TBD',
          date: e.eventDate ? e.eventDate.toISOString().split('T')[0] : null,
          eventDate: e.eventDate ? e.eventDate.toISOString() : null,
          eventEndDate: e.eventEndDate ? e.eventEndDate.toISOString() : null,
          price: r.feeCharged ?? e.fee ?? 0,
          normalPrice: e.fee ?? 0,
          isMemberPrice: r.isMemberPrice,
          image_url: e.bannerUrl,
          qr_url: e.qrUrl ?? (r.feeCharged > 0 && e.club ? e.club.qrUrl : null),
          upi_id: e.upiId ?? e.club?.upiId ?? null,
          team_size_limit: e.teamSizeLimit ?? null,
          min_team_size: e.minTeamSize ?? 2,
          club: e.club ? { id: e.club.id, name: e.club.name, logoUrl: e.club.logoUrl } : null,
        }
      : null,
  };
}

const TICKET_INCLUDE = {
  event: { include: { club: true } },
  team: { include: { registrations: { include: { profile: { select: { id: true, fullName: true } } } } } },
} satisfies Prisma.RegistrationInclude;

router.get('/user/tickets', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const registrations = await prisma.registration.findMany({
    where: { userId: user.id },
    include: TICKET_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 200,
  });
  return res.status(200).json({ tickets: registrations.map(toTicket) });
});

/** Paginated registration history. `status=active` (default) excludes rejected registrations. */
router.get('/registrations/mine', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const params = parsePaginationParams(req);
  const { skip, take } = prismaSkipTake(params);
  const status = optStr(req.query.status) ?? 'active';
  const where: Prisma.RegistrationWhereInput = {
    userId: user.id,
    ...(status === 'active' ? { status: { in: ['PENDING', 'CONFIRMED'] } } : status === 'all' ? {} : { status: status.toUpperCase() as any }),
    ...(params.search ? { event: { name: { contains: params.search, mode: 'insensitive' } } } : {}),
  };
  const [totalItems, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({ where, include: TICKET_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return res.status(200).json(buildPaginatedResult(rows.map(toTicket), totalItems, params));
});

// ─── Student: register (login required; all rules enforced server-side) ───────

router.post('/register', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const eventId = requiredStr(req.body.eventId, 'eventId', 64);
  const registration = await registerSolo(user.id, eventId);
  return res.status(201).json({ success: true, registration });
});

router.post('/teams/create', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const eventId = requiredStr(req.body.eventId, 'eventId', 64);
  const teamName = requiredStr(req.body.teamName, 'teamName', 80);
  const { team, registration } = await createTeam(user.id, eventId, teamName);
  return res.status(201).json({ success: true, passkey: team.passkey, teamId: team.id, registrationId: registration.id });
});

router.post('/teams/join', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const eventId = requiredStr(req.body.eventId, 'eventId', 64);
  const passkey = requiredStr(req.body.passkey, 'Passkey', 10);
  const registration = await joinTeam(user.id, eventId, passkey);
  return res.status(201).json({ success: true, registration });
});

// ─── Student: submit UPI payment reference ────────────────────────────────────

router.put('/registrations/:id/payment', requireStudent, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const transactionId = requiredStr(req.body.transactionId, 'Transaction ID', 64);
  if (!/^[A-Za-z0-9-]{6,64}$/.test(transactionId)) throw badRequest('Transaction ID must be 6–64 letters, digits or dashes.');

  const registration = await prisma.registration.findUnique({ where: { id: str(req.params.id) }, include: { event: true, team: true } });
  if (!registration || registration.userId !== user.id) throw notFound('Registration not found.');
  if (registration.status !== 'PENDING') throw badRequest(`This registration is already ${registration.status.toLowerCase()}.`);
  if (registration.feeCharged <= 0) throw badRequest('This event is free; no payment is required.');
  if (registration.teamId && registration.team && registration.team.leaderId !== user.id) {
    throw badRequest('Only the team leader submits payment for a team.');
  }

  const reused = await prisma.registration.findFirst({ where: { transactionId, id: { not: registration.id } }, select: { id: true } });
  if (reused) throw conflict('This transaction ID has already been used for another registration.');

  let passkey: string | null = null;
  if (registration.teamId && registration.team) {
    passkey = registration.team.passkey ?? (await generateUniquePasskey());
    if (!registration.team.passkey) await prisma.team.update({ where: { id: registration.teamId }, data: { passkey } });
  }
  const updated = await prisma.registration.update({ where: { id: registration.id }, data: { transactionId, paymentProofUrl: null } });
  return res.status(200).json({ success: true, passkey, registration: updated });
});

// ─── Club Head / Super Admin: review registrations ────────────────────────────

async function loadForReview(req: Request) {
  const user = currentUser(req);
  const registration = await prisma.registration.findUnique({
    where: { id: str(req.params.id) },
    include: { event: { include: { club: true } }, team: { include: { registrations: true } } },
  });
  if (!registration) throw notFound('Registration not found.');
  assertClubAccess(user, registration.event.clubId);

  const now = campusNow();
  const end = registration.event.eventEndDate ?? registration.event.eventDate;
  if (end < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) {
    throw badRequest('Cannot review registrations for an event that has already finished.');
  }
  return { user, registration };
}

router.put('/registrations/:id/approve', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, registration } = await loadForReview(req);
  const { event } = registration;

  await prisma.$transaction(async tx => {
    // Conditional update makes approval idempotent under double-clicks / retries.
    const changed = await tx.registration.updateMany({
      where: { id: registration.id, status: 'PENDING' },
      data: { status: 'CONFIRMED', paymentProofUrl: null },
    });
    if (changed.count === 0) throw conflict('This registration is not pending (already reviewed).');

    if (registration.teamId) {
      const checkedIn = registration.team?.registrations.find(r => r.status === 'CONFIRMED' && r.checkedInAt);
      if (checkedIn) await tx.registration.update({ where: { id: registration.id }, data: { checkedInAt: checkedIn.checkedInAt } });
    }

    // Paid ticket income → ledger. (refType, refId) is unique, so retries never double-count.
    if (registration.feeCharged > 0 && registration.transactionId) {
      await postLedger(
        {
          clubId: event.clubId,
          type: 'IN',
          category: 'TICKET',
          amountPaise: toPaise(registration.feeCharged),
          refType: 'registration',
          refId: registration.id,
          eventId: event.id,
          memo: `Ticket: ${event.name}`,
          actorId: user.id,
        },
        tx
      );
    }

    const isTeamMember = registration.teamId && registration.team && registration.userId !== registration.team.leaderId;
    await tx.notification.create({
      data: {
        userId: registration.userId,
        type: 'registration_approved',
        title: isTeamMember ? 'Team Join Request Approved' : 'Registration Approved',
        body: isTeamMember
          ? `Your request to join team "${registration.team!.teamName}" for ${event.name} has been approved by ${event.club.name}!`
          : `Your registration for ${event.name} by ${event.club.name} has been confirmed. See you there!`,
        eventId: event.id,
      },
    });
    await audit(user.id, 'APPROVE_REGISTRATION', 'Registration', registration.id, { eventId: event.id }, tx);
  });

  if (registration.paymentProofUrl) deleteImage(registration.paymentProofUrl).catch(() => {});
  return res.status(200).json({ message: 'Registration approved and notification sent.' });
});

router.delete('/registrations/:id/reject', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const { user, registration } = await loadForReview(req);
  const { event } = registration;
  if (registration.status === 'REJECTED') throw conflict('This registration is already rejected.');

  const isLeader = !!registration.team && registration.userId === registration.team.leaderId;
  const affected = isLeader ? registration.team!.registrations : [registration];

  await prisma.$transaction(async tx => {
    await tx.registration.updateMany({
      where: { id: { in: affected.map(r => r.id) } },
      data: { status: 'REJECTED', paymentProofUrl: null, checkedInAt: null },
    });
    if (isLeader) await tx.team.update({ where: { id: registration.teamId! }, data: { passkey: null } });

    const body = isLeader
      ? `Your team registration for ${event.name} by ${event.club.name} was rejected because the team leader request was rejected. You can now create or join a new team.`
      : registration.team
        ? `Your request to join team "${registration.team.teamName}" for ${event.name} was rejected by ${event.club.name}. You can now join another team or create your own.`
        : `Your registration for ${event.name} by ${event.club.name} was not approved. Please contact the club for details.`;
    await tx.notification.createMany({
      data: affected.map(r => ({
        userId: r.userId,
        type: 'registration_rejected',
        title: isLeader ? 'Team Registration Rejected' : 'Registration Update',
        body,
        eventId: event.id,
      })),
    });
    await audit(user.id, 'REJECT_REGISTRATION', 'Registration', registration.id, { eventId: event.id, affected: affected.length }, tx);
  });

  for (const r of affected) if (r.paymentProofUrl) deleteImage(r.paymentProofUrl).catch(() => {});
  return res.status(200).json({ message: 'Registration rejected successfully.' });
});

// ─── Club Head / Super Admin: venue check-in ──────────────────────────────────

router.post('/registrations/verify-ticket', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const ticketId = requiredStr(req.body.ticketId, 'Ticket QR payload', 100);
  const eventId = optStr(req.body.eventId);

  const include = {
    event: { include: { club: true } },
    profile: true,
    team: { include: { registrations: { include: { profile: true } } } },
  } satisfies Prisma.RegistrationInclude;

  let registration = /^[0-9a-f-]{36}$/i.test(ticketId)
    ? await prisma.registration.findUnique({ where: { id: ticketId }, include })
    : null;
  if (!registration) {
    const team = await prisma.team.findFirst({ where: { passkey: ticketId.toUpperCase(), ...(eventId ? { eventId } : {}) } });
    if (team) {
      registration = await prisma.registration.findFirst({ where: { teamId: team.id, userId: team.leaderId }, include });
    }
  }
  if (!registration) throw notFound('Invalid or unrecognized ticket QR code or Passkey.');
  assertClubAccess(user, registration.event.clubId);
  if (eventId && registration.eventId !== eventId) throw badRequest("This ticket doesn't belong to this event.");
  if (registration.status !== 'CONFIRMED') throw badRequest(`This ticket is ${registration.status.toLowerCase()}, not confirmed.`);

  const teamRegs = registration.team?.registrations ?? [];
  // Member / guest badge for everyone on this ticket, decided by the host club's active memberships.
  const memberIds = await activeMemberIds(registration.event.clubId, [registration.userId, ...teamRegs.map(r => r.userId)]);
  const badge = (userId: string) => ({ isMember: memberIds.has(userId), memberBadge: memberIds.has(userId) ? MEMBER_BADGE : GUEST_BADGE });
  const already = registration.checkedInAt || teamRegs.some(r => r.checkedInAt);
  if (already) {
    return res.status(200).json({
      valid: true,
      alreadyCheckedIn: true,
      message: registration.teamId
        ? `Team "${registration.team?.teamName || 'this team'}" has already been checked in.`
        : 'This ticket has already been checked in.',
      ...badge(registration.userId),
    });
  }

  const now = new Date();
  if (registration.teamId) {
    await prisma.registration.updateMany({ where: { teamId: registration.teamId, status: 'CONFIRMED' }, data: { checkedInAt: now } });
  } else {
    await prisma.registration.update({ where: { id: registration.id }, data: { checkedInAt: now } });
  }

  const person = (p: any, status: string) => ({
    id: p.id, name: p.fullName, email: p.email, usn: p.usn, branch: p.branch, phone: p.phone, year: p.year, sem: p.sem, status, ...badge(p.id),
  });
  const members = teamRegs
    .filter(r => r.profile && r.status === 'CONFIRMED')
    .map(r => ({ ...person(r.profile, r.status), isLeader: r.profile.id === registration!.team!.leaderId }))
    .sort((a, b) => (a.isLeader ? -1 : b.isLeader ? 1 : 0));

  return res.status(200).json({
    valid: true,
    ...badge(registration.userId),
    ticket: {
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      event: {
        id: registration.event.id,
        title: registration.event.name,
        date: registration.event.eventDate,
        venue: registration.event.venue,
        eventType: registration.event.eventType,
      },
      attendee: registration.profile ? person(registration.profile, registration.status) : null,
      team: registration.team
        ? { id: registration.team.id, name: registration.team.teamName, passkey: registration.team.passkey, leader: members.find(m => m.isLeader) || null, members }
        : null,
    },
  });
});

// ─── Public platform counters (public data only) ──────────────────────────────

router.get('/public/stats', async (_req: Request, res: Response): Promise<any> => {
  const campus = campusNow();
  const todayStart = new Date(Date.UTC(campus.getUTCFullYear(), campus.getUTCMonth(), campus.getUTCDate()));
  const [liveEvents, totalEvents, registrations, clubs, totalStudents] = await Promise.all([
    prisma.event.count({ where: { ...PUBLIC_EVENT_WHERE, eventDate: { gte: todayStart } } }),
    prisma.event.count({ where: PUBLIC_EVENT_WHERE }),
    prisma.registration.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, event: PUBLIC_EVENT_WHERE } }),
    prisma.club.count({ where: { isArchived: false } }),
    prisma.profile.count({ where: { role: Role.STUDENT, isActive: true } }),
  ]);
  return res.status(200).json({ liveEvents, registrations, clubs, totalEvents, totalStudents });
});

export default router;
