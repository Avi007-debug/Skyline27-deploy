import crypto from 'crypto';
import prisma from '../config/db';
import { Prisma, LedgerType } from '@prisma/client';

export const GENESIS_HASH = '0'.repeat(64);

export const ALLOWED_CATEGORIES = [
  'DUES',
  'TICKET',
  'MERCH',
  'FUNDRAISER',
  'EXPENSE',
  'OTHER',
] as const;

export type LedgerCategory = typeof ALLOWED_CATEGORIES[number];

export interface LedgerInput {
  clubId?: string;
  type: 'IN' | 'OUT';
  category: LedgerCategory | string;
  amountPaise: number;
  refType: string;
  refId: string;
  eventId?: string;
  projectId?: string;
  memo?: string;
  actorId?: string;
  reversesId?: number;
}

export interface VerifyChainResult {
  valid: boolean;
  entryCount: number;
  headHash: string;
  brokenAt?: number;
  reason?: string;
}

export function computeEntryHash(
  prevHash: string,
  entry: {
    type: string;
    category: string;
    amountPaise: number;
    refType: string;
    refId: string;
    eventId?: string | null;
    projectId?: string | null;
    memo?: string | null;
    actorId?: string | null;
    reversesId?: number | null;
  }
): string {
  const canonicalPayload = JSON.stringify({
    prevHash,
    type: entry.type,
    category: entry.category,
    amountPaise: entry.amountPaise,
    refType: entry.refType,
    refId: entry.refId,
    eventId: entry.eventId || null,
    projectId: entry.projectId || null,
    memo: entry.memo || null,
    actorId: entry.actorId || null,
    reversesId: entry.reversesId || null,
  });

  return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
}

/**
 * Posts a single financial transaction to the tamper-evident ledger.
 * Atomically acquires a lock on LedgerHead, checks idempotency,
 * computes the cryptographic hash chain, and writes the entry.
 */
export async function postLedger(
  input: LedgerInput,
  externalTx?: Prisma.TransactionClient
): Promise<{ entry: any; isDuplicate: boolean }> {
  // 1. Validation
  if (!input.amountPaise || typeof input.amountPaise !== 'number' || !Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error(`Invalid amountPaise: must be a positive integer > 0. Received: ${input.amountPaise}`);
  }

  if (!input.type || (input.type !== 'IN' && input.type !== 'OUT')) {
    throw new Error(`Invalid ledger type: must be 'IN' or 'OUT'. Received: ${input.type}`);
  }

  if (!input.refType || !input.refId) {
    throw new Error('Both refType and refId are required for ledger idempotency.');
  }

  const category = input.category.toUpperCase().trim();
  const ledgerType = input.type as LedgerType;

  const executeInTx = async (tx: Prisma.TransactionClient) => {
    // 2. Lock LedgerHead row 1 for concurrency control
    let head = await tx.$queryRaw<Array<{ id: number; last_hash: string }>>`
      SELECT id, last_hash FROM "LedgerHead" WHERE id = 1 FOR UPDATE
    `;

    let prevHash = GENESIS_HASH;

    if (!head || head.length === 0) {
      await tx.ledgerHead.create({
        data: {
          id: 1,
          lastHash: GENESIS_HASH,
        },
      });
      prevHash = GENESIS_HASH;
    } else {
      prevHash = head[0].last_hash;
    }

    // 3. Idempotency Check (under lock)
    const existing = await tx.ledgerEntry.findUnique({
      where: {
        refType_refId_type: {
          refType: input.refType,
          refId: input.refId,
          type: ledgerType,
        },
      },
    });

    if (existing) {
      return { entry: existing, isDuplicate: true };
    }

    // 4. Compute Hash Chain
    const hash = computeEntryHash(prevHash, {
      type: ledgerType,
      category,
      amountPaise: input.amountPaise,
      refType: input.refType,
      refId: input.refId,
      eventId: input.eventId,
      projectId: input.projectId,
      memo: input.memo,
      actorId: input.actorId,
      reversesId: input.reversesId,
    });

    // 5. Insert Entry
    const entry = await tx.ledgerEntry.create({
      data: {
        clubId: input.clubId || null,
        type: ledgerType,
        category,
        amountPaise: input.amountPaise,
        refType: input.refType,
        refId: input.refId,
        eventId: input.eventId || null,
        projectId: input.projectId || null,
        memo: input.memo || null,
        actorId: input.actorId || null,
        reversesId: input.reversesId || null,
        prevHash,
        hash,
      },
    });

    // 6. Update LedgerHead atomically
    await tx.ledgerHead.update({
      where: { id: 1 },
      data: { lastHash: hash },
    });

    return { entry, isDuplicate: false };
  };

  if (externalTx) {
    return executeInTx(externalTx);
  }

  return prisma.$transaction(async (tx) => executeInTx(tx), {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 10000,
  });
}

/**
 * Re-computes and verifies the complete cryptographic hash chain of the ledger.
 */
export async function verifyChain(): Promise<VerifyChainResult> {
  const entries = await prisma.ledgerEntry.findMany({
    orderBy: { id: 'asc' },
  });

  const head = await prisma.ledgerHead.findUnique({ where: { id: 1 } });
  const recordedHeadHash = head?.lastHash || GENESIS_HASH;

  if (entries.length === 0) {
    return {
      valid: recordedHeadHash === GENESIS_HASH,
      entryCount: 0,
      headHash: recordedHeadHash,
      reason: recordedHeadHash === GENESIS_HASH ? undefined : 'Empty ledger but LedgerHead hash is not genesis hash',
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check link to previous
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        entryCount: entries.length,
        headHash: recordedHeadHash,
        brokenAt: entry.id,
        reason: `Broken chain link at entry ID ${entry.id}: expected prevHash ${expectedPrevHash}, found ${entry.prevHash}`,
      };
    }

    // Recompute entry hash
    const recomputed = computeEntryHash(entry.prevHash, entry);
    if (recomputed !== entry.hash) {
      return {
        valid: false,
        entryCount: entries.length,
        headHash: recordedHeadHash,
        brokenAt: entry.id,
        reason: `Tampered hash at entry ID ${entry.id}: recomputed hash ${recomputed} does not match recorded hash ${entry.hash}`,
      };
    }

    expectedPrevHash = entry.hash;
  }

  // Check last entry matches LedgerHead
  if (expectedPrevHash !== recordedHeadHash) {
    return {
      valid: false,
      entryCount: entries.length,
      headHash: recordedHeadHash,
      reason: `LedgerHead mismatch: last entry hash ${expectedPrevHash} does not match LedgerHead ${recordedHeadHash}`,
    };
  }

  return {
    valid: true,
    entryCount: entries.length,
    headHash: recordedHeadHash,
  };
}
