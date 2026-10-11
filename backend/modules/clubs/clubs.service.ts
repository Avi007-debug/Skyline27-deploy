import { Prisma } from '@prisma/client';
import { badRequest } from '../../middlewares/errorHandler';

/**
 * Atomically consume a single-use registration key for a club. The conditional
 * update means two concurrent sign-ups can never both redeem the same key, and
 * expired keys are rejected. Run inside the transaction that creates the club.
 */
export async function claimRegistrationKey(tx: Prisma.TransactionClient, rawCode: string, clubId: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  const now = new Date();
  const claimed = await tx.registrationKey.updateMany({
    where: { code, isUsed: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    data: { isUsed: true, usedByClubId: clubId, usedAt: now },
  });
  if (claimed.count === 0) {
    throw badRequest('Invalid or expired registration key. Please enter a valid key provided by SkylineOS admins.');
  }
}

export function isKeyUsable(key: { isUsed: boolean; expiresAt: Date | null }, now = new Date()): boolean {
  return !key.isUsed && (!key.expiresAt || key.expiresAt > now);
}
