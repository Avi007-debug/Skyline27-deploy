import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';

/** The authenticated caller. Role and club come from the database, never from the client. */
export interface Principal {
  id: string;
  role: Role;
  clubId: string | null;
  email: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; googleEmail?: string };
      user?: Principal;
    }
  }
}

const googleClient = new OAuth2Client();

export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Resolve a bearer token to a user id. Accepts SkylineOS JWTs and, for the
 * mobile app, Google ID tokens issued to one of our configured client IDs.
 */
async function resolveUserId(token: string): Promise<{ userId: string; googleEmail?: string } | null> {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId?: string };
    if (decoded?.userId) return { userId: decoded.userId };
  } catch {
    // not a SkylineOS JWT — try Google below
  }

  if (token.split('.').length !== 3) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: env.googleClientIds });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return {
      userId: `google_${payload.sub}`,
      googleEmail: payload.email_verified && payload.email ? payload.email.toLowerCase() : undefined,
    };
  } catch {
    return null;
  }
}

async function loadPrincipal(userId: string): Promise<Principal | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, role: true, clubId: true, email: true, fullName: true, isActive: true },
  });
  if (!profile || !profile.isActive) return null;
  const { isActive: _active, ...principal } = profile;
  return principal;
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.substring(7).trim() : null;
}

/**
 * Authenticate the request. 401 when no valid token. A valid token whose user
 * has no profile yet (first Google sign-in before /auth/sync) still gets
 * req.auth so that sync can create the profile; req.user is set only when a
 * profile exists and is active.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  if (req.auth?.userId) return next();

  const token = bearer(req);
  const resolved = token ? await resolveUserId(token) : null;
  if (!resolved) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const { userId } = resolved;
  req.auth = resolved;
  const principal = await loadPrincipal(userId);
  if (principal) {
    req.user = principal;
  } else {
    const exists = await prisma.profile.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (exists && !exists.isActive) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact a SkylineOS administrator.' });
    }
  }
  return next();
};

/** Like requireAuth but never rejects: anonymous callers continue without req.user. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<any> => {
  if (req.auth?.userId) return next();
  const token = bearer(req);
  if (token) {
    const resolved = await resolveUserId(token);
    if (resolved) {
      req.auth = resolved;
      const principal = await loadPrincipal(resolved.userId);
      if (principal) req.user = principal;
    }
  }
  return next();
};
