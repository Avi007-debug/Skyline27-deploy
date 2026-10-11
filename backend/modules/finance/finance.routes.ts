import { Router, Request, Response } from 'express';
import prisma from '../../config/db';
import { requireClubManager, currentUser, resolveClubScope } from '../../middlewares/authorize';
import { optStr } from '../../utils/params';
import { HttpError } from '../../middlewares/errorHandler';
import { verifyChain } from './ledger.service';

const router = Router();

// 1. Finance Overview / Summary KPIs
router.get('/summary', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));

    const ledgerWhere: any = {};
    if (clubId) {
      ledgerWhere.clubId = clubId;
    }
    if (from || to) {
      ledgerWhere.createdAt = {};
      if (from) ledgerWhere.createdAt.gte = new Date(from as string);
      if (to) ledgerWhere.createdAt.lte = new Date(to as string);
    }

    // 1. Aggregate Total Income & Expenses
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { ...ledgerWhere, type: 'IN' },
        _sum: { amountPaise: true },
        _count: { id: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { ...ledgerWhere, type: 'OUT' },
        _sum: { amountPaise: true },
        _count: { id: true },
      }),
    ]);

    const totalIncomePaise = incomeAgg._sum.amountPaise || 0;
    const totalExpensePaise = expenseAgg._sum.amountPaise || 0;
    const netBalancePaise = totalIncomePaise - totalExpensePaise;

    // 2. Aggregate Owed to Volunteers (APPROVED but NOT YET reimbursed)
    const claimsWhere: any = { status: 'APPROVED' };
    if (clubId) {
      claimsWhere.clubId = clubId;
    }
    const owedAgg = await prisma.expenseClaim.aggregate({
      where: claimsWhere,
      _sum: { amountPaise: true },
      _count: { id: true },
    });
    const owedToVolunteersPaise = owedAgg._sum.amountPaise || 0;

    // 3. Category Breakdowns using PostgreSQL GROUP BY
    const categoryGroups = await prisma.ledgerEntry.groupBy({
      by: ['category', 'type'],
      where: ledgerWhere,
      _sum: { amountPaise: true },
      _count: { id: true },
    });

    const incomeByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};

    for (const group of categoryGroups) {
      const amount = group._sum.amountPaise || 0;
      if (group.type === 'IN') {
        incomeByCategory[group.category] = amount;
      } else {
        expensesByCategory[group.category] = amount;
      }
    }

    // 4. Per-Event Financial Performance
    const eventGroups = await prisma.ledgerEntry.groupBy({
      by: ['eventId', 'type'],
      where: {
        ...ledgerWhere,
        eventId: { not: null },
      },
      _sum: { amountPaise: true },
    });

    const eventMap: Record<string, { incomePaise: number; expensePaise: number }> = {};
    for (const g of eventGroups) {
      if (!g.eventId) continue;
      if (!eventMap[g.eventId]) {
        eventMap[g.eventId] = { incomePaise: 0, expensePaise: 0 };
      }
      const amt = g._sum.amountPaise || 0;
      if (g.type === 'IN') {
        eventMap[g.eventId].incomePaise += amt;
      } else {
        eventMap[g.eventId].expensePaise += amt;
      }
    }

    // Join with event names
    const eventIds = Object.keys(eventMap);
    const eventDetails = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, name: true, eventDate: true },
    });

    const eventPnL = eventDetails.map((ev) => {
      const stats = eventMap[ev.id] || { incomePaise: 0, expensePaise: 0 };
      return {
        eventId: ev.id,
        name: ev.name,
        date: ev.eventDate,
        incomePaise: stats.incomePaise,
        expensePaise: stats.expensePaise,
        netResultPaise: stats.incomePaise - stats.expensePaise,
      };
    });

    return res.status(200).json({
      summary: {
        totalIncomePaise,
        totalExpensePaise,
        netBalancePaise,
        owedToVolunteersPaise,
        totalTransactions: (incomeAgg._count.id || 0) + (expenseAgg._count.id || 0),
        pendingClaimsCount: owedAgg._count.id || 0,
      },
      incomeByCategory,
      expensesByCategory,
      eventPnL,
    });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Finance summary error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Filtered & Paginated Ledger List
router.get('/ledger', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, type, eventId, projectId, from, to, page = '1', limit = '20' } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));

    const where: any = {};
    if (category && typeof category === 'string') {
      where.category = category.toUpperCase();
    }
    if (type && (type === 'IN' || type === 'OUT')) {
      where.type = type;
    }
    if (eventId && typeof eventId === 'string') {
      where.eventId = eventId;
    }
    if (projectId && typeof projectId === 'string') {
      where.projectId = projectId;
    }
    if (clubId) {
      where.clubId = clubId;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return res.status(200).json({
      entries,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Fetch ledger error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Cryptographic Chain Integrity Verification
router.get('/audit/verify', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await verifyChain();
    return res.status(200).json({
      ...result,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Audit verify error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Semester Financial Report (JSON)
router.get('/report', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));
    const { generateSemesterReport } = await import('./reports.service');
    const report = await generateSemesterReport({
      clubId,
      from: from as string | undefined,
      to: to as string | undefined,
    });
    return res.status(200).json({ report });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Semester report error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Semester Financial Report CSV Download
router.get('/report/csv', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));
    const { generateSemesterReport, generateReportCSV } = await import('./reports.service');
    const report = await generateSemesterReport({
      clubId,
      from: from as string | undefined,
      to: to as string | undefined,
    });
    const csv = generateReportCSV(report);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="skyline_financial_report_${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Report CSV error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Semester Financial Report as a downloadable PDF
router.get('/report/pdf', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));
    const { generateSemesterReport } = await import('./reports.service');
    const { generateReportPDF } = await import('./reports.pdf');
    const report = await generateSemesterReport({ clubId, from: from as string | undefined, to: to as string | undefined });
    const pdf = await generateReportPDF(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="skyline_financial_report_${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.setHeader('Content-Length', String(pdf.length));
    return res.status(200).send(pdf);
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Report PDF error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 6. Semester Financial Report HTML / Printable Document
router.get('/report/html', requireClubManager, async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to } = req.query;
    const clubId = resolveClubScope(currentUser(req), optStr(req.query.clubId));
    const { generateSemesterReport, generateReportHTML } = await import('./reports.service');
    const report = await generateSemesterReport({
      clubId,
      from: from as string | undefined,
      to: to as string | undefined,
    });
    const html = generateReportHTML(report);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    console.error('Report HTML error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

