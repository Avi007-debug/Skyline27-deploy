import { Router, Request, Response } from 'express';
import { ExpenseStatus, Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { requireClubManager, assertClubAccess, currentUser, isSuperAdmin, resolveClubScope } from '../../middlewares/authorize';
import { badRequest, forbidden, notFound, HttpError } from '../../middlewares/errorHandler';
import { withRetry } from '../../utils/retry';
import { audit } from '../../utils/audit';
import { optBool, optInt, optStr, requiredStr, str } from '../../utils/params';
import { signedUrlFor, uploadPrivateImage } from '../../utils/storage';
import { postLedger } from './ledger.service';

/**
 * Expense claims belong to a club. Club heads manage their own club's claims;
 * Super Admin sees every club. A person can never approve their own claim.
 */
const router = Router();
router.use(requireClubManager);

const claimInclude = {
  claimant: { select: { id: true, fullName: true, email: true, usn: true, phone: true } },
  approver: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ExpenseClaimInclude;

/** Receipts live in a private bucket; hand the browser a short-lived signed link. */
async function withReceiptLink<T extends { receiptUrl: string }>(claim: T): Promise<T> {
  return { ...claim, receiptUrl: (await signedUrlFor(claim.receiptUrl)) ?? '' };
}

async function loadClaim(req: Request) {
  const user = currentUser(req);
  const claim = await prisma.expenseClaim.findUnique({ where: { id: str(req.params.id) } });
  if (!claim) throw notFound('Expense claim not found.');
  assertClubAccess(user, claim.clubId);
  return { user, claim };
}

router.post('/', async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const title = requiredStr(req.body.title, 'Claim title', 200);
  const amountPaise = optInt(req.body.amountPaise, 'amountPaise', { min: 1, max: 100_000_000 });
  if (!amountPaise) throw badRequest('amountPaise must be a positive integer greater than 0.');
  const receipt = requiredStr(req.body.receiptUrl, 'Receipt', 15_000_000);

  const clubId = isSuperAdmin(user) ? optStr(req.body.clubId) ?? null : user.clubId;
  if (clubId) assertClubAccess(user, clubId);

  const scanned = optInt(req.body.scannedAmount, 'scannedAmount', { min: 0 });
  const receiptUrl = await uploadPrivateImage(receipt, 'receipts');

  const claim = await prisma.expenseClaim.create({
    data: {
      claimantId: user.id,
      clubId,
      title,
      vendor: str(req.body.vendor).slice(0, 200) || null,
      amountPaise,
      category: str(req.body.category).toUpperCase().slice(0, 40) || 'EXPENSE',
      eventId: optStr(req.body.eventId) ?? null,
      projectId: optStr(req.body.projectId) ?? null,
      receiptUrl,
      scannedAmount: scanned ?? null,
      mismatchFlag: scanned !== undefined && scanned !== amountPaise,
      dateSpent: req.body.dateSpent ? new Date(req.body.dateSpent) : new Date(),
      status: ExpenseStatus.SUBMITTED,
    },
    include: claimInclude,
  });
  await audit(user.id, 'EXPENSE_SUBMITTED', 'ExpenseClaim', claim.id, { amountPaise, mismatch: claim.mismatchFlag });
  return res.status(201).json({ claim: await withReceiptLink(claim) });
});

router.get('/mine', async (req: Request, res: Response): Promise<any> => {
  const claims = await prisma.expenseClaim.findMany({
    where: { claimantId: currentUser(req).id },
    include: claimInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 200,
  });
  return res.status(200).json({ claims: await Promise.all(claims.map(withReceiptLink)) });
});

router.get('/', async (req: Request, res: Response): Promise<any> => {
  const user = currentUser(req);
  const status = optStr(req.query.status)?.toUpperCase();
  if (status && !Object.values(ExpenseStatus).includes(status as ExpenseStatus)) throw badRequest('Unknown status.');
  const clubId = resolveClubScope(user, optStr(req.query.clubId));

  const claims = await prisma.expenseClaim.findMany({
    where: { ...(status ? { status: status as ExpenseStatus } : {}), ...(optBool(req.query.flagged) ? { mismatchFlag: true } : {}), ...(clubId ? { clubId } : {}) },
    include: claimInclude,
    orderBy: [{ mismatchFlag: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: 500,
  });
  return res.status(200).json({ claims: await Promise.all(claims.map(withReceiptLink)) });
});

router.post('/:id/approve', async (req: Request, res: Response): Promise<any> => {
  const { user, claim } = await loadClaim(req);
  if (claim.claimantId === user.id) throw forbidden('Forbidden: Anti-fraud policy prevents approving your own expense claim.');
  if (claim.status !== ExpenseStatus.SUBMITTED) throw badRequest(`Cannot approve claim in status '${claim.status}'. Must be 'SUBMITTED'.`);

  const changed = await prisma.expenseClaim.updateMany({
    where: { id: claim.id, status: ExpenseStatus.SUBMITTED },
    data: { status: ExpenseStatus.APPROVED, approverId: user.id },
  });
  if (changed.count === 0) throw new HttpError(409, 'This claim was just updated. Refresh and try again.');
  await audit(user.id, 'EXPENSE_APPROVED', 'ExpenseClaim', claim.id, { amountPaise: claim.amountPaise, claimantId: claim.claimantId });
  const updated = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: claim.id }, include: claimInclude });
  // Approval does not post to the ledger; the claim sits in "owed to volunteers" until reimbursed.
  return res.status(200).json({ claim: await withReceiptLink(updated) });
});

router.post('/:id/reject', async (req: Request, res: Response): Promise<any> => {
  const { user, claim } = await loadClaim(req);
  const note = (str(req.body.reason) || str(req.body.decisionNote)).slice(0, 500);
  if (!note) throw badRequest('Rejection reason is required.');
  if (claim.status === ExpenseStatus.REIMBURSED) throw badRequest('Cannot reject an already reimbursed expense claim.');

  const changed = await prisma.expenseClaim.updateMany({
    where: { id: claim.id, status: { not: ExpenseStatus.REIMBURSED } },
    data: { status: ExpenseStatus.REJECTED, approverId: user.id, decisionNote: note },
  });
  if (changed.count === 0) throw new HttpError(409, 'This claim was just reimbursed.');
  await audit(user.id, 'EXPENSE_REJECTED', 'ExpenseClaim', claim.id, { reason: note });
  const updated = await prisma.expenseClaim.findUniqueOrThrow({ where: { id: claim.id }, include: claimInclude });
  return res.status(200).json({ claim: await withReceiptLink(updated) });
});

/** Atomically marks the claim reimbursed and posts the OUT/EXPENSE ledger entry. */
router.post('/:id/reimburse', async (req: Request, res: Response): Promise<any> => {
  const { user, claim: scoped } = await loadClaim(req);
  const result = await withRetry(() =>
    prisma.$transaction(async tx => {
      const claim = await tx.expenseClaim.findUnique({ where: { id: scoped.id } });
      if (!claim) throw notFound('Expense claim not found.');
      if (claim.status !== ExpenseStatus.APPROVED) throw badRequest(`Only APPROVED claims can be reimbursed. Current status: '${claim.status}'.`);

      const updatedClaim = await tx.expenseClaim.update({
        where: { id: claim.id },
        data: { status: ExpenseStatus.REIMBURSED, reimbursedAt: new Date() },
        include: { claimant: { select: { id: true, fullName: true, email: true } } },
      });
      const { entry, isDuplicate } = await postLedger(
        {
          clubId: claim.clubId || undefined,
          type: 'OUT',
          category: 'EXPENSE',
          amountPaise: claim.amountPaise,
          refType: 'expense_reimbursement',
          refId: claim.id,
          eventId: claim.eventId || undefined,
          projectId: claim.projectId || undefined,
          memo: `Reimbursement for: ${claim.title}`,
          actorId: user.id,
        },
        tx
      );
      await audit(user.id, 'EXPENSE_REIMBURSED', 'ExpenseClaim', claim.id, { amountPaise: claim.amountPaise, ledgerEntryId: entry.id, isDuplicate }, tx);
      return { claim: updatedClaim, ledgerEntry: entry };
    })
  );
  return res.status(200).json({ message: 'Claim successfully reimbursed and recorded in ledger.', claim: await withReceiptLink(result.claim as any), ledgerEntry: result.ledgerEntry });
});

export default router;
