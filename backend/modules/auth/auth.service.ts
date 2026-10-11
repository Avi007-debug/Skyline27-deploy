import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { signToken } from '../../middlewares/authenticate';
import { HttpError, badRequest } from '../../middlewares/errorHandler';
import { generateSecureToken, hashToken } from '../../utils/crypto';
import { sendMail } from '../../utils/mailer';
import { audit } from '../../utils/audit';
import { safeProfile } from '../profiles/profile.mapper';

export const SALT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 8;
const RESET_TTL_MS = 60 * 60 * 1000;

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (password.length > 128) throw badRequest('Password must be at most 128 characters long.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw badRequest('Password must contain at least one letter and one number.');
  }
  return password;
}

export const normalizeEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();

export function validateEmail(v: unknown): string {
  const email = normalizeEmail(v);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('A valid email address is required.');
  return email;
}

const isBcrypt = (v: string) => v.startsWith('$2a$') || v.startsWith('$2b$') || v.startsWith('$2y$');

/** Verify a password; transparently upgrades legacy plaintext passwords to bcrypt. */
export async function checkPassword(plain: string, stored: string, profileId: string): Promise<boolean> {
  if (isBcrypt(stored)) return bcrypt.compare(plain, stored);
  const match = plain.length === stored.length && crypto.timingSafeEqual(Buffer.from(plain), Buffer.from(stored));
  if (match) {
    await prisma.profile.update({ where: { id: profileId }, data: { password: await bcrypt.hash(plain, SALT_ROUNDS) } });
  }
  return match;
}

export function sessionFor(profile: any, extra: Record<string, unknown> = {}) {
  return { profile: safeProfile(profile), token: signToken(profile.id), ...extra };
}

/** Everyone uses the same website; the app routes each role to its own area after sign-in. */
export const siteLink = (path: string): string => `${env.siteUrl}${path}`;

export const GENERIC_RESET_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';

/**
 * Start a password reset. Always resolves the same way whether or not the
 * account exists. Only a SHA-256 hash of the token is stored; the raw token is
 * emailed once and is single-use.
 */
export async function requestPasswordReset(rawEmail: unknown): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) return;

  const profile = await prisma.profile.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, role: true, isActive: true },
  });
  // Google-only accounts (no password) and deactivated accounts get no email.
  if (!profile || !profile.password || !profile.isActive) return;

  const token = generateSecureToken(32);
  await prisma.profile.update({
    where: { id: profile.id },
    data: { passwordResetToken: hashToken(token), passwordResetExpiry: new Date(Date.now() + RESET_TTL_MS) },
  });

  const link = siteLink(`/reset-password?token=${token}&email=${encodeURIComponent(profile.email)}`);
  await sendMail({
    to: profile.email,
    subject: 'Reset your SkylineOS password',
    text: `We received a request to reset your SkylineOS password.\n\nOpen this link within 1 hour to choose a new password:\n${link}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your SkylineOS password.</p><p><a href="${link}">Choose a new password</a> (valid for 1 hour).</p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
  await audit(profile.id, 'PASSWORD_RESET_REQUESTED', 'Profile', profile.id);
}

async function findByValidResetToken(token: unknown, email: unknown) {
  if (typeof token !== 'string' || !token) return null;
  return prisma.profile.findFirst({
    where: { email: normalizeEmail(email), passwordResetToken: hashToken(token), passwordResetExpiry: { gte: new Date() }, isActive: true },
  });
}

export async function isResetTokenValid(token: unknown, email: unknown): Promise<boolean> {
  return !!(await findByValidResetToken(token, email));
}

export async function resetPassword(token: unknown, email: unknown, newPassword: unknown): Promise<void> {
  validatePassword(newPassword);
  const profile = await findByValidResetToken(token, email);
  if (!profile) throw new HttpError(400, 'Invalid or expired password reset link. Please request a new one.');

  const hashed = await bcrypt.hash(newPassword as string, SALT_ROUNDS);
  await prisma.$transaction(async tx => {
    // Conditional on the hash so a token cannot be redeemed twice concurrently.
    const claimed = await tx.profile.updateMany({
      where: { id: profile.id, passwordResetToken: profile.passwordResetToken },
      data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });
    if (claimed.count === 0) throw new HttpError(400, 'Invalid or expired password reset link. Please request a new one.');
    if (profile.clubId) await tx.club.update({ where: { id: profile.clubId }, data: { password: hashed } });
    await audit(profile.id, 'PASSWORD_RESET_COMPLETED', 'Profile', profile.id, undefined, tx);
  });
}
