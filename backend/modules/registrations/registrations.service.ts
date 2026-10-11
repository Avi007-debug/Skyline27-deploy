import crypto from 'crypto';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError, badRequest, conflict, notFound } from '../../middlewares/errorHandler';
import { eventPrice, isActiveMember } from '../memberships/membership.service';
import { ACTIVE_REGISTRATION_STATUSES, getRegistrationState, REGISTRATION_STATE_MESSAGES } from '../events/events.service';

type Tx = Prisma.TransactionClient;

const PASSKEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateUniquePasskey(db: Tx | typeof prisma = prisma): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = crypto.randomBytes(5);
    const passkey = Array.from(bytes, b => PASSKEY_CHARS[b % PASSKEY_CHARS.length]).join('');
    if (!(await db.team.findUnique({ where: { passkey } }))) return passkey;
  }
  throw new HttpError(500, 'Could not generate a unique team passkey.');
}

/**
 * Lock the event row and verify registration is open. Concurrent registrations for
 * the same event serialise on this lock, so the capacity check below cannot be raced.
 */
async function lockOpenEvent(tx: Tx, eventId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
  if (locked.length === 0) throw notFound('Event not found.');

  const event = await tx.event.findUnique({ where: { id: eventId }, include: { club: { select: { isArchived: true } } } });
  if (!event) throw notFound('Event not found.');

  const active = await tx.registration.count({ where: { eventId, status: { in: ACTIVE_REGISTRATION_STATUSES } } });
  const state = event.club.isArchived ? 'UNPUBLISHED' : getRegistrationState(event, active);
  if (state !== 'OPEN') {
    throw new HttpError(state === 'SOLD_OUT' ? 409 : 400, REGISTRATION_STATE_MESSAGES[state], { registrationState: state });
  }
  return { event, active };
}

/** Insert or revive (after a rejection) the user's single registration row for this event. */
/** What this student pays for the event, fixed now: the member price for active members of the host club. */
async function priceFor(tx: Tx, event: { fee: number; memberFee: number | null; clubId: string }, userId: string) {
  const member = await isActiveMember(userId, event.clubId, tx);
  const feeCharged = eventPrice(event, member);
  const status: RegistrationStatus = feeCharged === 0 ? 'CONFIRMED' : 'PENDING';
  return { feeCharged, isMemberPrice: member && feeCharged < event.fee, status };
}

async function upsertRegistration(tx: Tx, eventId: string, userId: string, data: { status: RegistrationStatus; teamId: string | null; feeCharged: number; isMemberPrice: boolean }) {
  const existing = await tx.registration.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (existing && existing.status !== 'REJECTED') {
    throw conflict('You are already registered for this event.');
  }
  if (existing) {
    return tx.registration.update({
      where: { id: existing.id },
      data: { ...data, transactionId: null, paymentProofUrl: null, checkedInAt: null, createdAt: new Date() },
    });
  }
  return tx.registration.create({ data: { eventId, userId, ...data } });
}

export async function registerSolo(userId: string, eventId: string) {
  return prisma.$transaction(async tx => {
    const { event } = await lockOpenEvent(tx, eventId);
    if (event.eventType === 'Team') throw badRequest('This is a team event. Create or join a team to register.');
    const price = await priceFor(tx, event, userId);
    return upsertRegistration(tx, eventId, userId, { ...price, teamId: null });
  });
}

export async function createTeam(userId: string, eventId: string, teamName: string) {
  return prisma.$transaction(async tx => {
    const { event } = await lockOpenEvent(tx, eventId);
    if (event.eventType === 'Solo' || event.eventType === 'Individual') throw badRequest('This is a solo event.');
    // Paid teams get their passkey after the leader submits payment.
    const price = await priceFor(tx, event, userId);
    const passkey = price.feeCharged === 0 ? await generateUniquePasskey(tx) : null;
    const team = await tx.team.create({ data: { eventId, teamName, passkey, leaderId: userId } });
    const registration = await upsertRegistration(tx, eventId, userId, { ...price, teamId: team.id });
    return { team, registration };
  });
}

export async function joinTeam(userId: string, eventId: string, passkey: string) {
  return prisma.$transaction(async tx => {
    const { event } = await lockOpenEvent(tx, eventId);
    const team = await tx.team.findFirst({ where: { eventId, passkey: passkey.trim().toUpperCase() } });
    if (!team || !team.passkey) throw notFound('Invalid passkey.');

    const leaderActive = await tx.registration.findFirst({
      where: { teamId: team.id, userId: team.leaderId, status: { in: ACTIVE_REGISTRATION_STATUSES } },
    });
    if (!leaderActive) throw notFound('Invalid passkey.');

    const members = await tx.registration.count({ where: { teamId: team.id, status: { in: ACTIVE_REGISTRATION_STATUSES } } });
    if (event.teamSizeLimit && members >= event.teamSizeLimit) throw conflict('This team is already full.');

    const price = await priceFor(tx, event, userId);
    return upsertRegistration(tx, eventId, userId, { ...price, teamId: team.id });
  });
}

/**
 * The registrations a club sees for an event. Unpaid PENDING rows of paid events
 * are hidden until the student (or their team leader) submits payment details.
 */
export async function listEventRegistrations(eventId: string) {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    include: { profile: true, team: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });

  const paidTeams = new Set(registrations.filter(r => r.teamId && r.transactionId !== null).map(r => r.teamId));
  const confirmedTeams = new Set(registrations.filter(r => r.teamId && r.status === 'CONFIRMED').map(r => r.teamId));

  return registrations
    .filter(r => {
      if (r.feeCharged === 0) return true;
      if (r.status === 'CONFIRMED' || r.status === 'REJECTED') return true;
      if (r.transactionId !== null) return true;
      if (r.teamId && (paidTeams.has(r.teamId) || confirmedTeams.has(r.teamId))) return true;
      return false;
    })
    .map(r => ({
      id: r.id,
      status: r.status,
      checkedInAt: r.checkedInAt,
      payment_proof_url: r.paymentProofUrl,
      transaction_id: r.transactionId,
      created_at: r.createdAt,
      fee_charged: r.feeCharged,
      is_member_price: r.isMemberPrice,
      user: r.profile
        ? {
            id: r.profile.id,
            name: r.profile.fullName,
            email: r.profile.email,
            usn: r.profile.usn,
            branch: r.profile.branch,
            phone: r.profile.phone,
            year: r.profile.year,
            sem: r.profile.sem,
          }
        : null,
      team: r.team ? { id: r.team.id, name: r.team.teamName, passkey: r.team.passkey, leaderId: r.team.leaderId } : null,
    }));
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
