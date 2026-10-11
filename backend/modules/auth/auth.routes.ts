import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { requireAuth } from '../../middlewares/authenticate';
import { requireUser, currentUser } from '../../middlewares/authorize';
import { authLimiter, recoveryLimiter } from '../../middlewares/rateLimit';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../../middlewares/errorHandler';
import { optInt, str } from '../../utils/params';
import { audit } from '../../utils/audit';
import { claimRegistrationKey } from '../clubs/clubs.service';
import { safeProfile } from '../profiles/profile.mapper';
import {
  SALT_ROUNDS,
  GENERIC_RESET_MESSAGE,
  checkPassword,
  isResetTokenValid,
  normalizeEmail,
  requestPasswordReset,
  resetPassword,
  sessionFor,
  validateEmail,
  validatePassword,
} from './auth.service';

const router = Router();
const googleOAuthClient = new OAuth2Client();

const BAD_CREDENTIALS = 'Incorrect email or password.';
const DEACTIVATED = 'This account has been deactivated. Contact a SkylineOS administrator.';

router.use(['/login', '/club-login', '/admin-login', '/signup', '/google'], authLimiter);

// ─── Student sign-up / login ──────────────────────────────────────────────────

router.post('/signup', async (req: Request, res: Response): Promise<any> => {
  const email = validateEmail(req.body.email);
  const password = validatePassword(req.body.password);
  const name = str(req.body.name);
  if (!name) throw badRequest('Name is required.');
  const usn = str(req.body.usn) || null;

  if (await prisma.profile.findUnique({ where: { email } })) throw conflict('An account with this email already exists.');
  if (await prisma.club.findUnique({ where: { email } })) throw conflict('This email is registered to a club account.');
  if (usn && (await prisma.profile.findUnique({ where: { usn } }))) throw conflict('An account with this USN already exists.');

  // Role is never accepted from the client: public sign-up always creates a STUDENT.
  const profile = await prisma.profile.create({
    data: {
      id: `user_${crypto.randomBytes(6).toString('hex')}`,
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
      fullName: name.slice(0, 120),
      usn,
      branch: str(req.body.branch) || null,
      phone: str(req.body.phone) || null,
      year: optInt(req.body.year, 'year', { min: 1, max: 6 }) ?? null,
      sem: optInt(req.body.sem, 'sem', { min: 1, max: 12 }) ?? null,
      role: Role.STUDENT,
    },
  });
  return res.status(201).json({ message: 'Account created successfully', ...sessionFor(profile) });
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const email = normalizeEmail(req.body.email);
  const password = str(req.body.password);
  if (!email || !password) throw badRequest('Email and Password are required.');

  const profile = await prisma.profile.findUnique({ where: { email } });
  if (!profile || profile.role !== Role.STUDENT) throw new HttpError(401, BAD_CREDENTIALS);
  if (!profile.password) throw new HttpError(401, 'This account uses Google sign-in. Please use the Google button.');
  if (!(await checkPassword(password, profile.password, profile.id))) throw new HttpError(401, BAD_CREDENTIALS);
  if (!profile.isActive) throw forbidden(DEACTIVATED);

  return res.status(200).json({ message: 'Logged in successfully', ...sessionFor(profile) });
});

// ─── Club Head login (club credentials) ───────────────────────────────────────

router.post('/club-login', async (req: Request, res: Response): Promise<any> => {
  const email = normalizeEmail(req.body.email);
  const password = str(req.body.password);
  if (!email || !password) throw badRequest('Email and Password are required.');

  const club = await prisma.club.findUnique({ where: { email } });
  if (!club || !club.password || !(await bcrypt.compare(password, club.password))) throw new HttpError(401, BAD_CREDENTIALS);
  if (club.isArchived) throw forbidden('This club has been archived. Contact a SkylineOS administrator.');

  let profile = await prisma.profile.findFirst({ where: { clubId: club.id, role: Role.CLUB_HEAD }, orderBy: { createdAt: 'asc' } });
  if (!profile) {
    profile = await prisma.profile.findUnique({ where: { email } });
    if (profile && profile.role === Role.SUPER_ADMIN) throw new HttpError(401, BAD_CREDENTIALS);
    profile = profile
      ? await prisma.profile.update({ where: { id: profile.id }, data: { clubId: club.id, role: Role.CLUB_HEAD } })
      : await prisma.profile.create({
          data: { id: `user_${crypto.randomBytes(6).toString('hex')}`, email, password: club.password, fullName: `${club.name} Admin`, clubId: club.id, role: Role.CLUB_HEAD },
        });
  }
  if (!profile.isActive) throw forbidden(DEACTIVATED);
  return res.status(200).json({ message: 'Logged in successfully', ...sessionFor(profile, { club: { id: club.id, name: club.name, logoUrl: club.logoUrl } }) });
});

// ─── Super Admin login (admin app) ────────────────────────────────────────────

router.post('/admin-login', async (req: Request, res: Response): Promise<any> => {
  const email = normalizeEmail(req.body.email);
  const password = str(req.body.password);
  if (!email || !password) throw badRequest('Email and Password are required.');

  const profile = await prisma.profile.findUnique({ where: { email } });
  if (!profile || profile.role !== Role.SUPER_ADMIN || !profile.password) throw new HttpError(401, BAD_CREDENTIALS);
  if (!(await checkPassword(password, profile.password, profile.id))) {
    await audit(profile.id, 'ADMIN_LOGIN_FAILED', 'Profile', profile.id);
    throw new HttpError(401, BAD_CREDENTIALS);
  }
  if (!profile.isActive) throw forbidden(DEACTIVATED);
  await audit(profile.id, 'ADMIN_LOGIN', 'Profile', profile.id);
  return res.status(200).json({ message: 'Logged in successfully', ...sessionFor(profile) });
});

// ─── Google sign-in (club onboarding with registration key) ───────────────────

router.post('/google', async (req: Request, res: Response): Promise<any> => {
  const { credential, access_token: accessToken, registrationKey } = req.body;
  if (!credential && !accessToken) throw badRequest('Google credential or access token is required.');

  let payload: { email?: string; name?: string; given_name?: string; picture?: string; sub?: string; email_verified?: boolean } | null = null;
  if (credential) {
    try {
      const ticket = await googleOAuthClient.verifyIdToken({ idToken: String(credential), audience: env.googleClientIds });
      payload = ticket.getPayload() ?? null;
    } catch {
      payload = null;
    }
  } else {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (r.ok) payload = (await r.json()) as any;
    } catch {
      payload = null;
    }
  }
  if (!payload?.email || !payload.sub || payload.email_verified === false) {
    throw new HttpError(401, 'Invalid Google credential or unverified email address.');
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || 'SkylineOS User';
  const googleUserId = `google_${payload.sub}`;

  let club = await prisma.club.findUnique({ where: { email } });
  let profile = await prisma.profile.findUnique({ where: { email } });
  if (profile?.role === Role.SUPER_ADMIN) throw new HttpError(401, BAD_CREDENTIALS);

  if (!club && registrationKey) {
    const clubName = str(req.body.clubName) || name;
    club = await prisma.$transaction(async tx => {
      const created = await tx.club.create({ data: { name: clubName.slice(0, 120), email, logoUrl: payload!.picture || null } });
      await claimRegistrationKey(tx, String(registrationKey), created.id);
      profile = profile
        ? await tx.profile.update({ where: { id: profile.id }, data: { clubId: created.id, role: Role.CLUB_HEAD } })
        : await tx.profile.create({ data: { id: googleUserId, fullName: name, email, clubId: created.id, role: Role.CLUB_HEAD } });
      return created;
    });
  }

  if (!club) throw notFound('No club exists with this email address. Please register your club first.');
  if (club.isArchived) throw forbidden('This club has been archived. Contact a SkylineOS administrator.');

  if (!profile) {
    profile = await prisma.profile.create({ data: { id: googleUserId, fullName: name, email, clubId: club.id, role: Role.CLUB_HEAD } });
  } else if (profile.clubId !== club.id || profile.role !== Role.CLUB_HEAD) {
    profile = await prisma.profile.update({ where: { id: profile.id }, data: { clubId: club.id, role: Role.CLUB_HEAD } });
  }
  if (!profile.isActive) throw forbidden(DEACTIVATED);
  return res.status(200).json({ message: 'Google login successful', ...sessionFor(profile, { club }) });
});

// ─── Session helpers ──────────────────────────────────────────────────────────

router.get('/me', requireUser, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, include: { club: { select: { id: true, name: true, logoUrl: true } } } });
  return res.status(200).json({ profile: safeProfile(profile) });
});

/** Re-authentication for genuinely sensitive actions (credentials, security settings). */
router.post('/verify-password', requireAuth, authLimiter, async (req: Request, res: Response): Promise<any> => {
  const password = str(req.body.password);
  if (!password) throw badRequest('Password is required.');
  const profile = await prisma.profile.findUnique({ where: { id: req.auth!.userId } });
  if (!profile) throw notFound('User not found.');
  if (!profile.password) return res.status(200).json({ valid: true });
  if (!(await checkPassword(password, profile.password, profile.id))) throw new HttpError(401, 'Incorrect password.');
  return res.status(200).json({ valid: true });
});

router.post('/change-password', requireUser, authLimiter, async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const oldPassword = str(req.body.oldPassword);
  const newPassword = validatePassword(req.body.newPassword);
  if (!oldPassword) throw badRequest('Old password and new password are required.');
  if (oldPassword === newPassword) throw badRequest('The new password must be different from the old password.');

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, include: { club: true } });
  if (!profile) throw notFound('User profile not found.');
  const stored = profile.club?.password ?? profile.password;
  if (!stored) throw badRequest('No password is set for this account.');

  const ok = profile.club ? await bcrypt.compare(oldPassword, stored) : await checkPassword(oldPassword, stored, profile.id);
  if (!ok) throw new HttpError(401, 'Incorrect old password.');

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction(async tx => {
    await tx.profile.update({ where: { id: profile.id }, data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null } });
    if (profile.clubId) await tx.club.update({ where: { id: profile.clubId }, data: { password: hashed } });
    await audit(profile.id, 'PASSWORD_CHANGED', 'Profile', profile.id, undefined, tx);
  });
  return res.status(200).json({ message: 'Password updated successfully.' });
});

/**
 * Link a Google identity to its profile. Uses only the email verified by Google
 * inside the ID token — an email supplied in the request body is never trusted,
 * otherwise anyone could claim another person's account.
 */
router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<any> => {
  const googleId = req.auth!.userId;
  const email = req.auth!.googleEmail;
  if (!email) {
    const existing = await prisma.profile.findUnique({ where: { id: googleId } });
    if (!existing) throw notFound('Profile not found.');
    return res.status(200).json({ message: 'Profile synced', profile: safeProfile(existing) });
  }

  const name = str(req.body.name) || 'SkylineOS User';
  const byEmail = await prisma.profile.findUnique({ where: { email } });
  if (byEmail?.role === Role.SUPER_ADMIN && byEmail.id !== googleId) throw forbidden();

  const profile = await prisma.$transaction(async tx => {
    if (byEmail && byEmail.id !== googleId) {
      // Move the existing account (and its history) onto the Google identity.
      await tx.profile.update({ where: { id: byEmail.id }, data: { email: `${byEmail.id}@migrated.invalid`, usn: null } });
      const moved = await tx.profile.create({
        data: {
          id: googleId, email, fullName: byEmail.fullName, usn: byEmail.usn, branch: byEmail.branch, phone: byEmail.phone,
          year: byEmail.year, sem: byEmail.sem, clubId: byEmail.clubId, role: byEmail.role, password: byEmail.password,
        },
      });
      await tx.registration.updateMany({ where: { userId: byEmail.id }, data: { userId: googleId } });
      await tx.notification.updateMany({ where: { userId: byEmail.id }, data: { userId: googleId } });
      await tx.team.updateMany({ where: { leaderId: byEmail.id }, data: { leaderId: googleId } });
      await tx.order.updateMany({ where: { userId: byEmail.id }, data: { userId: googleId } });
      await tx.profile.delete({ where: { id: byEmail.id } });
      return moved;
    }
    return tx.profile.upsert({
      where: { id: googleId },
      update: {},
      create: { id: googleId, email, fullName: name.slice(0, 120), role: Role.STUDENT },
    });
  });

  // A club registered with this exact (Google-verified) email links its head automatically.
  const club = !profile.clubId && profile.role === Role.STUDENT ? await prisma.club.findUnique({ where: { email } }) : null;
  const finalProfile = club && !club.isArchived
    ? await prisma.profile.update({ where: { id: profile.id }, data: { clubId: club.id, role: Role.CLUB_HEAD } })
    : profile;
  return res.status(200).json({ message: 'Profile synced', profile: safeProfile(finalProfile) });
});

// ─── Password recovery ────────────────────────────────────────────────────────

router.post('/forgot-password', recoveryLimiter, async (req: Request, res: Response): Promise<any> => {
  if (typeof req.body?.email !== 'string' || !req.body.email.trim()) throw badRequest('Email address is required.');
  try {
    await requestPasswordReset(req.body.email);
  } catch (err: any) {
    // Never let internal failures reveal whether the account exists.
    console.error('[Auth] forgot-password failed:', err?.message);
  }
  return res.status(200).json({ message: GENERIC_RESET_MESSAGE });
});

router.post('/validate-reset-token', recoveryLimiter, async (req: Request, res: Response): Promise<any> => {
  const valid = await isResetTokenValid(req.body?.token, req.body?.email);
  return res.status(200).json(valid ? { valid: true } : { valid: false, error: 'This reset link is invalid or has expired.' });
});

router.post('/reset-password', recoveryLimiter, async (req: Request, res: Response): Promise<any> => {
  await resetPassword(req.body?.token, req.body?.email, req.body?.newPassword);
  return res.status(200).json({ message: 'Password updated successfully. You can now log in with your new password.' });
});

export default router;
