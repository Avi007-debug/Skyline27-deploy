import { Prisma, RegistrationStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { campusNow } from '../../utils/time';

/** Registrations that occupy a seat. REJECTED rows do not count toward capacity or stats. */
export const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = ['PENDING', 'CONFIRMED'];

export type RegistrationState = 'OPEN' | 'UPCOMING' | 'CLOSED' | 'SOLD_OUT' | 'ENDED' | 'UNPUBLISHED';

interface EventWindowFields {
  isPublished: boolean;
  isArchived: boolean;
  registrationClosedManually: boolean;
  registrationOpensAt: Date | null;
  registrationDeadline: Date | null;
  eventDate: Date;
  eventEndDate: Date | null;
  registrationLimit: number;
}

/**
 * The single server-side rule for whether registration is open.
 *
 *  - Unpublished / archived events never accept registrations.
 *  - Manual close (registrationClosedManually) wins over everything else.
 *  - Before registrationOpensAt (if set) → UPCOMING.
 *  - After registrationDeadline (if set) → CLOSED. A null deadline is valid:
 *    registration then stays open until the event starts.
 *  - Once the event has started → CLOSED (ENDED after the event end).
 *  - When active registrations reach registrationLimit → SOLD_OUT.
 */
export function getRegistrationState(event: EventWindowFields, activeCount: number, now = campusNow()): RegistrationState {
  if (!event.isPublished || event.isArchived) return 'UNPUBLISHED';
  const end = event.eventEndDate ?? event.eventDate;
  if (now > end) return 'ENDED';
  if (event.registrationClosedManually) return 'CLOSED';
  if (event.registrationOpensAt && now < event.registrationOpensAt) return 'UPCOMING';
  if (event.registrationDeadline && now > event.registrationDeadline) return 'CLOSED';
  if (now >= event.eventDate) return 'CLOSED';
  if (event.registrationLimit > 0 && activeCount >= event.registrationLimit) return 'SOLD_OUT';
  return 'OPEN';
}

export const REGISTRATION_STATE_MESSAGES: Record<Exclude<RegistrationState, 'OPEN'>, string> = {
  UNPUBLISHED: 'This event is not open for registration.',
  ENDED: 'This event has already ended.',
  CLOSED: 'Registration for this event is closed.',
  UPCOMING: 'Registration for this event has not opened yet.',
  SOLD_OUT: 'Registration full. Capacity reached for this event.',
};

/** Count active registrations for many events in one query. */
export async function activeCounts(eventIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (eventIds.length === 0) return map;
  const groups = await prisma.registration.groupBy({
    by: ['eventId'],
    where: { eventId: { in: eventIds }, status: { in: ACTIVE_REGISTRATION_STATUSES } },
    _count: { _all: true },
  });
  for (const g of groups) map.set(g.eventId, g._count._all);
  return map;
}

/** Visibility filter for anyone (including anonymous visitors). */
export const PUBLIC_EVENT_WHERE: Prisma.EventWhereInput = {
  isPublished: true,
  isArchived: false,
  club: { isArchived: false },
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

type EventWithClub = Prisma.EventGetPayload<{ include: { club: true } }>;

/**
 * Public event shape. Only fields intended for the public: no registrant data,
 * no internal flags beyond what explains availability. Field aliases are kept
 * for the existing web_app, Flutter app and club dashboard clients.
 */
export function toPublicEvent(e: EventWithClub, activeCount: number, now = campusNow()) {
  const type = e.eventType === 'Individual' ? 'Solo' : e.eventType ?? 'Solo';
  const state = getRegistrationState(e, activeCount, now);
  const spotsLeft = e.registrationLimit > 0 ? Math.max(0, e.registrationLimit - activeCount) : null;
  return {
    id: e.id,
    title: e.name,
    name: e.name,
    description: e.description ?? '',
    venue: e.venue ?? 'TBD',
    image_url: e.bannerUrl ?? null,
    bannerUrl: e.bannerUrl ?? null,
    category: type,
    eventType: type,
    price: e.fee ?? 0,
    fee: e.fee ?? 0,
    memberFee: e.memberFee ?? null,
    date: iso(e.eventDate),
    eventDate: iso(e.eventDate),
    eventEndDate: iso(e.eventEndDate),
    registrationOpensAt: iso(e.registrationOpensAt),
    registration_deadline: iso(e.registrationDeadline),
    registrationDeadline: iso(e.registrationDeadline),
    registration_limit: e.registrationLimit,
    registrationLimit: e.registrationLimit,
    teamSizeLimit: e.teamSizeLimit,
    minTeamSize: e.minTeamSize ?? null,
    registrationCount: activeCount,
    spotsLeft,
    registrationState: state,
    registrationOpen: state === 'OPEN',
    upiId: e.upiId ?? e.club?.upiId ?? null,
    qrUrl: e.qrUrl ?? (e.fee > 0 && e.club ? e.club.qrUrl : null),
    clubLogoUrl: e.club?.logoUrl ?? null,
    club: e.club
      ? { id: e.club.id, name: e.club.name, logoUrl: e.club.logoUrl, logo_url: e.club.logoUrl, upiId: e.upiId ?? e.club.upiId }
      : null,
  };
}

/** Management shape for club heads and super admins: public fields + publication controls. */
export function toManagedEvent(e: EventWithClub, activeCount: number, now = campusNow()) {
  return {
    ...toPublicEvent(e, activeCount, now),
    clubId: e.clubId,
    isPublished: e.isPublished,
    taskCount: e.taskCount,
    taskDoneCount: e.taskDoneCount,
    isArchived: e.isArchived,
    registrationClosedManually: e.registrationClosedManually,
  };
}

export type EventStatusFilter = 'open' | 'upcoming' | 'closed' | 'past' | 'live';

/** Participation-type filter. Legacy rows may say "Individual" for solo events. */
export function typeFilter(type: string | undefined): Prisma.EventWhereInput | undefined {
  if (type === 'Team') return { eventType: 'Team' };
  if (type === 'Solo') return { eventType: { in: ['Solo', 'Individual'] } };
  return undefined;
}

/** Date-based list filters, translated to SQL so pagination totals stay correct. */
export function timeFilter(filter: string | undefined, now = campusNow()): Prisma.EventWhereInput | undefined {
  switch (filter) {
    case 'upcoming':
      return { eventDate: { gt: now } };
    case 'live':
      return { eventDate: { lte: now }, eventEndDate: { gte: now } };
    case 'past':
      return { OR: [{ eventEndDate: { lt: now } }, { eventEndDate: null, eventDate: { lt: now } }] };
    case 'open':
      // Mirrors getRegistrationState except capacity, which is applied per row in the response.
      return {
        registrationClosedManually: false,
        eventDate: { gt: now },
        AND: [
          { OR: [{ registrationOpensAt: null }, { registrationOpensAt: { lte: now } }] },
          { OR: [{ registrationDeadline: null }, { registrationDeadline: { gte: now } }] },
        ],
      };
    case 'closed':
      return {
        eventDate: { gt: now },
        OR: [{ registrationClosedManually: true }, { registrationDeadline: { lt: now } }],
      };
    default:
      return undefined;
  }
}
