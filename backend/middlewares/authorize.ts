import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, Principal } from './authenticate';
import { forbidden, unauthorized, notFound } from './errorHandler';

/**
 * SkylineOS role-based access control.
 *
 * Exactly three roles, each served by its own frontend:
 *   SUPER_ADMIN → admin/      platform-wide authority over every club, event, user and key
 *   CLUB_HEAD   → frontend/   full control of their own club only (profile.clubId)
 *   STUDENT     → web_app/    public browsing + their own registrations, orders and profile
 *
 * Every rule lives here so routes declare intent (`requireRole`, `assertClubAccess`)
 * instead of re-implementing checks. The role is always read from the database by
 * `requireAuth`; nothing in the request body can change it.
 */
export const ROLES = Role;
export type AppRole = Role;

export const isSuperAdmin = (user?: Principal | null): boolean => user?.role === Role.SUPER_ADMIN;
export const isClubHead = (user?: Principal | null): boolean => user?.role === Role.CLUB_HEAD && !!user.clubId;
export const isStudent = (user?: Principal | null): boolean => user?.role === Role.STUDENT;

/** True when the user may manage (read private data of / mutate) the given club. */
export function canManageClub(user: Principal | null | undefined, clubId: string | null | undefined): boolean {
  if (!user || !clubId) return isSuperAdmin(user);
  if (isSuperAdmin(user)) return true;
  return isClubHead(user) && user.clubId === clubId;
}

/** Throw 403 unless the user manages this club. Use after loading a resource to check ownership. */
export function assertClubAccess(user: Principal | null | undefined, clubId: string | null | undefined): void {
  if (!user) throw unauthorized();
  if (!canManageClub(user, clubId)) {
    throw forbidden('Forbidden: This resource belongs to a club you do not manage.');
  }
}

/**
 * Resolve which club a club-scoped list/report should cover.
 * - SUPER_ADMIN: the requested club (or undefined = all clubs)
 * - CLUB_HEAD:   always their own club; asking for another club is a 403
 */
export function resolveClubScope(user: Principal, requestedClubId?: string | null): string | undefined {
  if (isSuperAdmin(user)) return requestedClubId || undefined;
  if (isClubHead(user)) {
    if (requestedClubId && requestedClubId !== user.clubId) {
      throw forbidden('Forbidden: You can only access data for your own club.');
    }
    return user.clubId!;
  }
  throw forbidden();
}

/** Narrow req.user after requireAuth. Throws 401 if the profile does not exist. */
export function currentUser(req: Request): Principal {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * Authenticate and require one of the given roles. Returns 401 when
 * unauthenticated and 403 when authenticated without permission.
 * A CLUB_HEAD without an assigned club is treated as unauthorised for club routes.
 */
export const requireRole = (...allowed: Role[]): RequestHandler[] => [
  requireAuth,
  (req: Request, res: Response, next: NextFunction): any => {
    const user = req.user;
    if (!user) return res.status(403).json({ error: 'Forbidden: Profile not found.' });
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires role ${allowed.join(' or ')}.` });
    }
    if (user.role === Role.CLUB_HEAD && !user.clubId) {
      return res.status(403).json({ error: 'Forbidden: Your account is not assigned to a club.' });
    }
    return next();
  },
];

export const requireSuperAdmin = requireRole(Role.SUPER_ADMIN);
/** Club management routes: the club's head, or a super admin acting on any club. */
export const requireClubManager = requireRole(Role.CLUB_HEAD, Role.SUPER_ADMIN);
/** Any signed-in account with a profile. */
export const requireUser = requireRole(Role.STUDENT, Role.CLUB_HEAD, Role.SUPER_ADMIN);

/** 404 (not 403) for resources a caller may not know exist, e.g. another student's ticket. */
export function assertOwner(user: Principal, ownerId: string | null | undefined): void {
  if (isSuperAdmin(user)) return;
  if (!ownerId || ownerId !== user.id) throw notFound();
}
