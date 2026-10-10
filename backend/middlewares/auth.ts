import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'spotlight_dev_secret_change_in_production';

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {

    if (req.auth?.userId) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        if (decoded && decoded.userId) {
          req.auth = { userId: decoded.userId } as any;
          return next();
        }
      } catch (err) {

      }

      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (googleRes.ok) {
          const googleData = await googleRes.json() as any;
          if (googleData && googleData.sub) {
            req.auth = { userId: `google_${googleData.sub}` } as any;
            return next();
          }
        }
      } catch (err) {
        console.error('[Auth] Google ID token verification error:', err);
      }
    }

    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  } catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }
};

export const requireOptionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (req.auth?.userId) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        if (decoded && decoded.userId) {
          req.auth = { userId: decoded.userId } as any;
          return next();
        }
      } catch (err) {}

      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (googleRes.ok) {
          const googleData = await googleRes.json() as any;
          if (googleData && googleData.sub) {
            req.auth = { userId: `google_${googleData.sub}` } as any;
            return next();
          }
        }
      } catch (err) {}
    }

    return next();
  } catch (error: any) {
    return next();
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const runCheck = async () => {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      }

      // Platform admin secret bypass
      const adminSecret = req.headers['x-admin-secret'];
      if (adminSecret && adminSecret === (process.env.ADMIN_SECRET || 'skyline_admin_secret_key_2026')) {
        return next();
      }

      const { prisma } = await import('../config/db');
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
      });

      if (!profile) {
        return res.status(403).json({ error: 'Forbidden: Profile not found.' });
      }

      const isClubAdmin = Boolean(profile.clubId);
      const userRole = (profile as any).role || 'MEMBER';

      if (
        allowedRoles.includes(userRole) ||
        (isClubAdmin && (allowedRoles.includes('ADMIN') || allowedRoles.includes('TREASURER')))
      ) {
        (req as any).userProfile = profile;
        return next();
      }

      return res.status(403).json({
        error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role. Current role: ${userRole}.`,
      });
    };

    if (req.auth?.userId) {
      return runCheck();
    }

    return requireAuth(req, res, () => runCheck());
  };
};

