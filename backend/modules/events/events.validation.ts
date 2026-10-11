import { badRequest } from '../../middlewares/errorHandler';
import { optBool, optDate, optInt, optNumber, oneOf, str } from '../../utils/params';

export interface EventInput {
  name?: string;
  description?: string;
  venue?: string;
  eventType?: 'Solo' | 'Team';
  fee?: number;
  memberFee?: number | null;
  registrationLimit?: number;
  teamSizeLimit?: number | null;
  minTeamSize?: number | null;
  eventDate?: Date;
  eventEndDate?: Date | null;
  registrationOpensAt?: Date | null;
  registrationDeadline?: Date | null;
  upiId?: string | null;
  isPublished?: boolean;
}

interface Existing {
  fee: number;
  memberFee: number | null;
  eventType: string;
  eventDate: Date;
  eventEndDate: Date | null;
  registrationOpensAt: Date | null;
  registrationDeadline: Date | null;
  teamSizeLimit: number | null;
  minTeamSize: number | null;
}

/**
 * Validate create/update payloads. On update only provided fields are returned;
 * cross-field rules are checked against the merged result.
 */
export function parseEventInput(body: any, existing?: Existing): EventInput {
  const out: EventInput = {};
  const isCreate = !existing;

  if (body.name !== undefined || isCreate) {
    const name = str(body.name);
    if (!name) throw badRequest('Event name is required.');
    if (name.length > 200) throw badRequest('Event name must be at most 200 characters.');
    out.name = name;
  }
  if (body.description !== undefined) {
    const d = String(body.description ?? '');
    if (d.length > 10000) throw badRequest('Description must be at most 10,000 characters.');
    out.description = d;
  }
  if (body.venue !== undefined) out.venue = str(body.venue).slice(0, 300) || 'TBD';

  const type = oneOf(body.eventType === 'Individual' ? 'Solo' : body.eventType, ['Solo', 'Team'] as const, 'eventType');
  if (type) out.eventType = type;

  const fee = optNumber(body.fee, 'fee', { min: 0 });
  if (fee !== undefined) out.fee = Math.round(fee * 100) / 100;

  // Price for active club members; empty/null = members pay the normal fee.
  if (body.memberFee !== undefined) {
    if (body.memberFee === null || body.memberFee === '') out.memberFee = null;
    else {
      const mf = optNumber(body.memberFee, 'memberFee', { min: 0 });
      if (mf !== undefined) out.memberFee = Math.round(mf * 100) / 100;
    }
  }
  const finalFee = out.fee ?? existing?.fee ?? 0;
  const finalMemberFee = out.memberFee !== undefined ? out.memberFee : existing?.memberFee ?? null;
  if (finalMemberFee !== null && finalMemberFee > finalFee) throw badRequest('The member fee cannot be higher than the normal fee.');

  const limit = optInt(body.registrationLimit, 'registrationLimit', { min: 1, max: 100000 });
  if (limit !== undefined) out.registrationLimit = limit;

  const eventDate = optDate(body.eventDate, 'eventDate');
  if (eventDate === null) throw badRequest('eventDate cannot be empty.');
  if (eventDate) out.eventDate = eventDate;
  if (isCreate && !eventDate) throw badRequest('eventDate is required.');

  const end = optDate(body.eventEndDate, 'eventEndDate');
  if (end !== undefined) out.eventEndDate = end;
  const opens = optDate(body.registrationOpensAt, 'registrationOpensAt');
  if (opens !== undefined) out.registrationOpensAt = opens;
  const deadline = optDate(body.registrationDeadline, 'registrationDeadline');
  if (deadline !== undefined) out.registrationDeadline = deadline;

  if (body.upiId !== undefined) out.upiId = str(body.upiId) || null;
  const published = optBool(body.isPublished);
  if (published !== undefined) out.isPublished = published;

  // Team sizing
  const finalType = out.eventType ?? existing?.eventType ?? 'Solo';
  if (finalType === 'Team') {
    const max = optInt(body.teamSizeLimit, 'teamSizeLimit', { min: 1, max: 100 });
    const min = optInt(body.minTeamSize, 'minTeamSize', { min: 1, max: 100 });
    if (max !== undefined) out.teamSizeLimit = max;
    if (min !== undefined) out.minTeamSize = min;
    const effMax = out.teamSizeLimit ?? existing?.teamSizeLimit ?? null;
    const effMin = out.minTeamSize ?? existing?.minTeamSize ?? 1;
    if (isCreate && effMax === null) throw badRequest('teamSizeLimit is required for team events.');
    if (effMax !== null && effMin > effMax) throw badRequest('minTeamSize cannot exceed teamSizeLimit.');
    if (out.minTeamSize === undefined && isCreate) out.minTeamSize = 1;
  } else if (out.eventType === 'Solo') {
    out.teamSizeLimit = null;
    out.minTeamSize = null;
  }

  // Date ordering on the merged event
  const start = out.eventDate ?? existing?.eventDate;
  const finalEnd = out.eventEndDate !== undefined ? out.eventEndDate : existing?.eventEndDate ?? null;
  const finalOpens = out.registrationOpensAt !== undefined ? out.registrationOpensAt : existing?.registrationOpensAt ?? null;
  const finalDeadline = out.registrationDeadline !== undefined ? out.registrationDeadline : existing?.registrationDeadline ?? null;
  if (start && finalEnd && finalEnd < start) throw badRequest('The event end must be after the event start.');
  if (finalOpens && finalDeadline && finalDeadline < finalOpens) {
    throw badRequest('The registration closing date must be after the registration opening date.');
  }
  if (finalOpens && start && finalOpens > start) throw badRequest('Registration must open before the event starts.');

  return out;
}
