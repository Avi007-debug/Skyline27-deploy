import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

/**
 * Consolidated role-based authorization middleware.
 * Always fetches the role from the database — never trusts client-supplied roles.
 */

export type AppRole = 'STUDENT' | 'MEMBER' | 'VOLUNTEER' | 'TREASURER' | 'CLUB_HEAD' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * Returns true if the user has one of the allowed roles.
 * SUPER_ADMIN passes every check.
 * ADMIN and CLUB_HEAD are treated equivalently for club-scoped resources.
 */
export function roleAllowed(userRole: string, allowedRoles: AppRole[]): boolean {
  if (userRole === 'SUPER_ADMIN') return true;
  return allowedRoles.includes(userRole as AppRole);
}

/**
 * requireRole(allowedRoles) — Middleware that:
 * 1. Requires the user to be authenticated (reads req.auth.userId)
 * 2. Fetches the profile from DB to get the authoritative role
 * 3. Allows SUPER_ADMIN through unconditionally
 * 4. Checks the list of allowed roles
 */
export const requireRole = (allowedRoles: AppRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    try {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true, role: true, clubId: true },
      });

      if (!profile) {
        return res.status(403).json({ error: 'Forbidden: Profile not found.' });
      }

      const userRole = profile.role as string;

      // SUPER_ADMIN bypasses all role checks
      if (userRole === 'SUPER_ADMIN') {
        (req as any).userProfile = profile;
        return next();
      }

      // Legacy: treat ADMIN as CLUB_HEAD for backward compatibility
      const effectiveRole = userRole === 'ADMIN' ? 'CLUB_HEAD' : userRole;

      if (allowedRoles.includes(effectiveRole as AppRole) || allowedRoles.includes(userRole as AppRole)) {
        (req as any).userProfile = profile;
        return next();
      }

      return res.status(403).json({
        error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role. Current role: ${userRole}.`,
      });
    } catch (err: any) {
      console.error('[requireRole] Error fetching profile:', err);
      return res.status(500).json({ error: 'Internal server error during authorization.' });
    }
  };
};

/**
 * requireSuperAdmin — Convenience middleware for SUPER_ADMIN only routes
 */
export const requireSuperAdmin = requireRole(['SUPER_ADMIN']);

/**
 * requireClubHead — Allows SUPER_ADMIN, CLUB_HEAD, or ADMIN role.
 * Optionally scopes to a specific club if clubId is passed.
 */
export const requireClubHead = requireRole(['CLUB_HEAD', 'ADMIN', 'SUPER_ADMIN']);

/**
 * requireSameUserOrAdmin — Allows the resource owner OR admin roles
 * The route must set req.params.userId or req.body.userId for the ownership check.
 */
export const requireSameUserOrAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authUserId = req.auth?.userId;
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: authUserId },
      select: { id: true, role: true, clubId: true },
    });

    if (!profile) {
      return res.status(403).json({ error: 'Forbidden: Profile not found.' });
    }

    const userRole = profile.role as string;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'CLUB_HEAD';
    const targetUserId = req.params.id || req.params.userId || req.body.userId;

    if (isAdmin || authUserId === targetUserId) {
      (req as any).userProfile = profile;
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: You can only access your own data.' });
  } catch (err: any) {
    console.error('[requireSameUserOrAdmin] Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
