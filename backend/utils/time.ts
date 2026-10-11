import { env } from '../config/env';

/**
 * Event times in SkylineOS are "floating" wall-clock values: the clubs enter
 * 10:00 and every client shows 10:00, because the date fields are read without
 * applying a timezone. They are stored as UTC fields to keep that exact value.
 *
 * So the server must compare them with the campus wall clock, not the UTC
 * clock. Set CAMPUS_UTC_OFFSET_MINUTES (e.g. 330 for India) so that "registration
 * closes at 23:59" means 23:59 on campus. Leave it at 0 if the apps and server
 * already share a timezone.
 */
export function campusNow(): Date {
  return new Date(Date.now() + env.campusUtcOffsetMinutes * 60_000);
}
