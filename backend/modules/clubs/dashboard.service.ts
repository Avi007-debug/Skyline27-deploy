import { prisma } from '../../config/db';
import { toManagedEvent, activeCounts } from '../events/events.service';
import { listEventRegistrations } from '../registrations/registrations.service';
import { clubStats } from '../profiles/stats.service';
import { campusNow } from '../../utils/time';

type Phase = 'live' | 'upcoming' | 'previous';

export function eventPhase(eventDate: Date | null, eventEndDate?: Date | null, now = campusNow()): Phase {
  if (!eventDate) return 'upcoming';
  const end = eventEndDate ?? new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59, 999);
  if (now < eventDate) return 'upcoming';
  return now <= end ? 'live' : 'previous';
}

/** Club dashboard payload (shape preserved for the existing club UI). Team registrations count once per team. */
export async function clubDashboard(clubId: string) {
  const events = await prisma.event.findMany({
    where: { clubId, isArchived: false },
    include: { club: true },
    orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
  });
  const counts = await activeCounts(events.map(e => e.id));
  const perEvent = await Promise.all(events.map(async e => ({ event: e, regs: await listEventRegistrations(e.id) })));
  const stats = await clubStats(clubId);

  const unitsOf = (regs: Awaited<ReturnType<typeof listEventRegistrations>>, status?: string) => {
    const rows = status ? regs.filter(r => r.status === status) : regs.filter(r => r.status !== 'REJECTED');
    const teams = new Set(rows.filter(r => r.team).map(r => r.team!.id));
    return rows.filter(r => !r.team).length + teams.size;
  };

  const allRegs = perEvent.flatMap(p => p.regs.map(r => ({ ...r, eventTitle: p.event.name, eventId: p.event.id })));
  const recentActivity = allRegs
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      status: r.status,
      created_at: new Date(r.created_at).toISOString(),
      eventTitle: r.eventTitle,
      eventId: r.eventId,
      paymentProofUrl: r.payment_proof_url,
      transactionId: r.transaction_id,
      user: r.user,
      team: r.team,
    }));

  const now = campusNow();
  const clubEvents = perEvent.map(({ event: e, regs }) => ({
    ...toManagedEvent(e, counts.get(e.id) ?? 0, now),
    capacity: e.registrationLimit,
    type: e.eventType,
    club: e.club.name,
    club_id: e.clubId,
    status: eventPhase(e.eventDate, e.eventEndDate, now),
    price: e.fee,
    pendingCount: unitsOf(regs, 'PENDING'),
  }));

  return {
    totalEvents: stats.eventsCount,
    upcomingEventsCount: events.filter(e => eventPhase(e.eventDate, e.eventEndDate, now) !== 'previous').length,
    totalRegistrations: perEvent.reduce((n, p) => n + unitsOf(p.regs), 0),
    pendingCount: perEvent.reduce((n, p) => n + unitsOf(p.regs, 'PENDING'), 0),
    recentActivity,
    clubEvents,
  };
}
