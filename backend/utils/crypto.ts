import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token.
 * @param byteLength Number of random bytes (default 32 → 64-char hex string)
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Generate a secure registration key in the format SKYLINE-XXXX-XXXX
 * Uses crypto.randomBytes instead of Math.random
 */
export function generateRegistrationKey(prefix: string = 'SKYLINE'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from(crypto.randomBytes(4))
    .map(b => chars[b % chars.length])
    .join('');
  const part2 = Array.from(crypto.randomBytes(4))
    .map(b => chars[b % chars.length])
    .join('');
  return `${prefix}-${part1}-${part2}`;
}

/**
 * Hash a token for safe storage (one-way).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a plain token against a stored hash.
 */
export function verifyToken(plain: string, stored: string): boolean {
  return hashToken(plain) === stored;
}
