import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Record a consequential administrative action. Details must never contain
 * secrets (passwords, tokens, full registration keys).
 */
export async function audit(
  actorId: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  db: Db = prisma
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: actorId || null,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err: any) {
    // Inside a transaction the caller must see the failure; outside, auditing must not break the request.
    if (db !== prisma) throw err;
    console.error(`[Audit] Failed to record ${action} on ${entityType}:${entityId}:`, err?.message);
  }
}

/** Show only the start of a key in logs/audit details. */
export const maskKey = (code: string): string => (code.length <= 8 ? '****' : `${code.slice(0, 8)}****`);
