import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { requireAuth, requireRole } from '../middlewares/auth';
import { postLedger } from '../services/ledger';
import { withRetry } from '../utils/retry';
import { ExpenseStatus } from '@prisma/client';

const router = Router();

// 1. Volunteer: Submit a new expense claim
router.post('/', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.auth!.userId;
    const {
      title,
      vendor,
      amountPaise,
      category,
      eventId,
      projectId,
      receiptUrl,
      scannedAmount,
      dateSpent,
      clubId,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Claim title is required.' });
    }

    const parsedAmount = parseInt(amountPaise, 10);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amountPaise must be a positive integer greater than 0.' });
    }

    if (!receiptUrl || typeof receiptUrl !== 'string' || !receiptUrl.trim()) {
      return res.status(400).json({ error: 'Valid receipt URL is required to submit an expense claim.' });
    }

    // Determine mismatch flag if scanned amount is provided
    let mismatchFlag = false;
    let parsedScannedAmount: number | null = null;
    if (scannedAmount !== undefined && scannedAmount !== null) {
      parsedScannedAmount = parseInt(scannedAmount, 10);
      if (!isNaN(parsedScannedAmount) && parsedScannedAmount !== parsedAmount) {
        mismatchFlag = true;
      }
    }

    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const targetClubId = clubId || profile?.clubId || null;

    const claim = await prisma.expenseClaim.create({
      data: {
        claimantId: userId,
        clubId: targetClubId,
        title: title.trim(),
        vendor: vendor ? String(vendor).trim() : null,
        amountPaise: parsedAmount,
        category: category ? String(category).toUpperCase().trim() : 'EXPENSE',
        eventId: eventId || null,
        projectId: projectId || null,
        receiptUrl: receiptUrl.trim(),
        scannedAmount: parsedScannedAmount,
        mismatchFlag,
        dateSpent: dateSpent ? new Date(dateSpent) : new Date(),
        status: ExpenseStatus.SUBMITTED,
      },
      include: {
        claimant: {
          select: { id: true, fullName: true, email: true, usn: true },
        },
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'EXPENSE_SUBMITTED',
        entityType: 'ExpenseClaim',
        entityId: claim.id,
        details: JSON.stringify({
          amountPaise: parsedAmount,
          title: claim.title,
          mismatchFlag,
        }),
      },
    });

    return res.status(201).json({ claim });
  } catch (error: any) {
    console.error('Submit expense error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Volunteer: View their own claims
router.get('/mine', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.auth!.userId;
    const claims = await prisma.expenseClaim.findMany({
      where: { claimantId: userId },
      include: {
        approver: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ claims });
  } catch (error: any) {
    console.error('Fetch my expenses error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Treasurer / Admin: View claims queue with filters
router.get('/', requireRole(['TREASURER', 'ADMIN']), async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, flagged, clubId } = req.query;

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status.toUpperCase();
    }
    if (flagged === 'true') {
      where.mismatchFlag = true;
    }
    if (clubId && typeof clubId === 'string') {
      where.clubId = clubId;
    }

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        claimant: {
          select: { id: true, fullName: true, email: true, usn: true, phone: true },
        },
        approver: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: [
        { mismatchFlag: 'desc' }, // prioritize flagged claims
        { createdAt: 'desc' },
      ],
    });

    return res.status(200).json({ claims });
  } catch (error: any) {
    console.error('Fetch claims queue error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Treasurer / Admin: Approve claim (Self-approval rejected with 403)
router.post('/:id/approve', requireRole(['TREASURER', 'ADMIN']), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.auth!.userId;

    const claim = await prisma.expenseClaim.findUnique({ where: { id: id as string } });
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    // Anti-fraud guard: A claimant cannot approve their own claim!
    if (claim.claimantId === userId) {
      return res.status(403).json({
        error: 'Forbidden: Anti-fraud policy prevents approving your own expense claim.',
      });
    }

    if (claim.status !== ExpenseStatus.SUBMITTED) {
      return res.status(400).json({
        error: `Cannot approve claim in status '${claim.status}'. Must be 'SUBMITTED'.`,
      });
    }

    const updated = await prisma.expenseClaim.update({
      where: { id: id as string },
      data: {
        status: ExpenseStatus.APPROVED,
        approverId: userId,
      },
      include: {
        claimant: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'EXPENSE_APPROVED',
        entityType: 'ExpenseClaim',
        entityId: claim.id,
        details: JSON.stringify({
          amountPaise: claim.amountPaise,
          claimantId: claim.claimantId,
        }),
      },
    });

    // NOTE: Does NOT post to ledger yet. Approved claim remains in "Owed to volunteers".
    return res.status(200).json({ claim: updated });
  } catch (error: any) {
    console.error('Approve expense error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Treasurer / Admin: Reject claim with required reason
router.post('/:id/reject', requireRole(['TREASURER', 'ADMIN']), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.auth!.userId;
    const { reason, decisionNote } = req.body;

    const note = (reason || decisionNote || '').trim();
    if (!note) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    const claim = await prisma.expenseClaim.findUnique({ where: { id: id as string } });
    if (!claim) {
      return res.status(404).json({ error: 'Expense claim not found.' });
    }

    if (claim.status === ExpenseStatus.REIMBURSED) {
      return res.status(400).json({ error: 'Cannot reject an already reimbursed expense claim.' });
    }

    const updated = await prisma.expenseClaim.update({
      where: { id: id as string },
      data: {
        status: ExpenseStatus.REJECTED,
        approverId: userId,
        decisionNote: note,
      },
      include: {
        claimant: { select: { id: true, fullName: true, email: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'EXPENSE_REJECTED',
        entityType: 'ExpenseClaim',
        entityId: claim.id,
        details: JSON.stringify({ reason: note }),
      },
    });

    return res.status(200).json({ claim: updated });
  } catch (error: any) {
    console.error('Reject expense error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 6. Treasurer: Reimburse approved claim (Atomically posts to ledger OUT / EXPENSE)
router.post('/:id/reimburse', requireRole(['TREASURER', 'ADMIN']), async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = req.auth!.userId;

    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        const claim = await tx.expenseClaim.findUnique({
          where: { id: id as string },
        });

        if (!claim) {
          throw new Error('Expense claim not found.');
        }

        if (claim.status !== ExpenseStatus.APPROVED) {
          throw new Error(`Only APPROVED claims can be reimbursed. Current status: '${claim.status}'.`);
        }

        // 1. Update claim status to REIMBURSED
        const updatedClaim = await tx.expenseClaim.update({
          where: { id: id as string },
          data: {
            status: ExpenseStatus.REIMBURSED,
            reimbursedAt: new Date(),
          },
          include: {
            claimant: { select: { id: true, fullName: true, email: true } },
          },
        });

        // 2. Post atomic OUT/EXPENSE ledger transaction
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
            actorId: userId,
          },
          tx
        );

        // 3. Write audit log
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'EXPENSE_REIMBURSED',
            entityType: 'ExpenseClaim',
            entityId: claim.id,
            details: JSON.stringify({
              amountPaise: claim.amountPaise,
              ledgerEntryId: entry.id,
              isDuplicate,
            }),
          },
        });

        return { claim: updatedClaim, ledgerEntry: entry };
      });
    });

    return res.status(200).json({
      message: 'Claim successfully reimbursed and recorded in ledger.',
      claim: result.claim,
      ledgerEntry: result.ledgerEntry,
    });
  } catch (error: any) {
    console.error('Reimburse expense error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: error.message });
  }
});

export default router;
