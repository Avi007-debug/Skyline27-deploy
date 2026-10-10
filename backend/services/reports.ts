import prisma from '../config/db';
import { verifyChain } from './ledger';

export interface SemesterReportData {
  generatedAt: string;
  reportingPeriod: {
    from: string | null;
    to: string | null;
  };
  club?: {
    id: string;
    name: string;
  } | null;
  vaultSummary: {
    openingBalancePaise: number;
    totalIncomePaise: number;
    totalExpensePaise: number;
    closingBalancePaise: number;
    owedToVolunteersPaise: number;
  };
  incomeBreakdown: {
    duesCollectedPaise: number;
    ticketSalesPaise: number;
    merchandiseRevenuePaise: number;
    fundraiserIncomePaise: number;
    otherIncomePaise: number;
  };
  expensesByCategory: Record<string, number>;
  eventPerformance: Array<{
    eventId: string;
    name: string;
    date: string | null;
    registrationCount: number;
    revenuePaise: number;
    expensesPaise: number;
    netResultPaise: number;
  }>;
  claimsStatistics: {
    submittedCount: number;
    approvedCount: number;
    rejectedCount: number;
    reimbursedCount: number;
    owedToVolunteersPaise: number;
  };
  ledgerAudit: {
    isChainValid: boolean;
    totalLedgerEntries: number;
    lastHeadHash: string;
  };
}

export async function generateSemesterReport(params: {
  clubId?: string;
  from?: string;
  to?: string;
}): Promise<SemesterReportData> {
  const { clubId, from, to } = params;

  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const hasDateFilter = from || to;

  // 1. Ledger aggregations for the current period
  const currentPeriodWhere: any = {};
  if (clubId) currentPeriodWhere.clubId = clubId;
  if (hasDateFilter) currentPeriodWhere.createdAt = dateFilter;

  // 2. Opening Balance (transactions prior to 'from')
  let openingBalancePaise = 0;
  if (from) {
    const priorWhere: any = { createdAt: { lt: new Date(from) } };
    if (clubId) priorWhere.clubId = clubId;

    const [priorIn, priorOut] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { ...priorWhere, type: 'IN' },
        _sum: { amountPaise: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { ...priorWhere, type: 'OUT' },
        _sum: { amountPaise: true },
      }),
    ]);

    openingBalancePaise = (priorIn._sum.amountPaise || 0) - (priorOut._sum.amountPaise || 0);
  }

  // 3. Category aggregates for current period
  const categoryGroups = await prisma.ledgerEntry.groupBy({
    by: ['category', 'type'],
    where: currentPeriodWhere,
    _sum: { amountPaise: true },
  });

  let duesCollectedPaise = 0;
  let ticketSalesPaise = 0;
  let merchandiseRevenuePaise = 0;
  let fundraiserIncomePaise = 0;
  let otherIncomePaise = 0;
  let totalIncomePaise = 0;
  let totalExpensePaise = 0;
  const expensesByCategory: Record<string, number> = {};

  for (const g of categoryGroups) {
    const amt = g._sum.amountPaise || 0;
    if (g.type === 'IN') {
      totalIncomePaise += amt;
      switch (g.category) {
        case 'DUES':
          duesCollectedPaise += amt;
          break;
        case 'TICKET':
          ticketSalesPaise += amt;
          break;
        case 'MERCH':
          merchandiseRevenuePaise += amt;
          break;
        case 'FUNDRAISER':
          fundraiserIncomePaise += amt;
          break;
        default:
          otherIncomePaise += amt;
          break;
      }
    } else {
      totalExpensePaise += amt;
      expensesByCategory[g.category] = (expensesByCategory[g.category] || 0) + amt;
    }
  }

  const closingBalancePaise = openingBalancePaise + totalIncomePaise - totalExpensePaise;

  // 4. Claims Statistics
  const claimWhere: any = {};
  if (clubId) claimWhere.clubId = clubId;
  if (hasDateFilter) claimWhere.createdAt = dateFilter;

  const claimGroups = await prisma.expenseClaim.groupBy({
    by: ['status'],
    where: claimWhere,
    _count: { id: true },
    _sum: { amountPaise: true },
  });

  let submittedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let reimbursedCount = 0;
  let owedToVolunteersPaise = 0;

  for (const cg of claimGroups) {
    const cnt = cg._count.id || 0;
    const amt = cg._sum.amountPaise || 0;
    switch (cg.status) {
      case 'SUBMITTED':
        submittedCount = cnt;
        break;
      case 'APPROVED':
        approvedCount = cnt;
        owedToVolunteersPaise = amt;
        break;
      case 'REJECTED':
        rejectedCount = cnt;
        break;
      case 'REIMBURSED':
        reimbursedCount = cnt;
        break;
    }
  }

  // 5. Per-event performance
  const eventLedger = await prisma.ledgerEntry.groupBy({
    by: ['eventId', 'type'],
    where: {
      ...currentPeriodWhere,
      eventId: { not: null },
    },
    _sum: { amountPaise: true },
  });

  const eventStatsMap: Record<string, { inPaise: number; outPaise: number }> = {};
  for (const el of eventLedger) {
    if (!el.eventId) continue;
    if (!eventStatsMap[el.eventId]) eventStatsMap[el.eventId] = { inPaise: 0, outPaise: 0 };
    const amt = el._sum.amountPaise || 0;
    if (el.type === 'IN') eventStatsMap[el.eventId].inPaise += amt;
    else eventStatsMap[el.eventId].outPaise += amt;
  }

  const events = await prisma.event.findMany({
    include: {
      _count: { select: { registrations: true } },
    },
    orderBy: { eventDate: 'desc' },
  });

  const eventPerformance = events.map((ev) => {
    const st = eventStatsMap[ev.id] || { inPaise: 0, outPaise: 0 };
    return {
      eventId: ev.id,
      name: ev.name,
      date: ev.eventDate ? ev.eventDate.toISOString() : null,
      registrationCount: ev._count.registrations,
      revenuePaise: st.inPaise,
      expensesPaise: st.outPaise,
      netResultPaise: st.inPaise - st.outPaise,
    };
  });

  // 6. Cryptographic Chain Status
  const auditResult = await verifyChain();

  // 7. Club metadata
  let clubData: any = null;
  if (clubId) {
    clubData = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, name: true },
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    reportingPeriod: {
      from: from || null,
      to: to || null,
    },
    club: clubData,
    vaultSummary: {
      openingBalancePaise,
      totalIncomePaise,
      totalExpensePaise,
      closingBalancePaise,
      owedToVolunteersPaise,
    },
    incomeBreakdown: {
      duesCollectedPaise,
      ticketSalesPaise,
      merchandiseRevenuePaise,
      fundraiserIncomePaise,
      otherIncomePaise,
    },
    expensesByCategory,
    eventPerformance,
    claimsStatistics: {
      submittedCount,
      approvedCount,
      rejectedCount,
      reimbursedCount,
      owedToVolunteersPaise,
    },
    ledgerAudit: {
      isChainValid: auditResult.valid,
      totalLedgerEntries: auditResult.entryCount,
      lastHeadHash: auditResult.headHash,
    },
  };
}

export function formatPaiseToINR(paise: number): string {
  const rupees = paise / 100;
  return `INR ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateReportCSV(report: SemesterReportData): string {
  const lines: string[] = [];

  lines.push('=== SKYLINEOS TREASURER SEMESTER FINANCIAL REPORT ===');
  lines.push(`Generated At,${report.generatedAt}`);
  lines.push(`Reporting Period,${report.reportingPeriod.from || 'Start'} to ${report.reportingPeriod.to || 'Present'}`);
  lines.push(`Club,${report.club?.name || 'All Clubs / Global'}`);
  lines.push('');

  lines.push('=== 1. VAULT & BALANCE RECONCILIATION ===');
  lines.push(`Opening Balance,${formatPaiseToINR(report.vaultSummary.openingBalancePaise)}`);
  lines.push(`Total Income (+),${formatPaiseToINR(report.vaultSummary.totalIncomePaise)}`);
  lines.push(`Total Expenses (-),${formatPaiseToINR(report.vaultSummary.totalExpensePaise)}`);
  lines.push(`Closing Vault Balance (=),${formatPaiseToINR(report.vaultSummary.closingBalancePaise)}`);
  lines.push(`Owed to Volunteers (Approved Unpaid Claims),${formatPaiseToINR(report.vaultSummary.owedToVolunteersPaise)}`);
  lines.push('');

  lines.push('=== 2. INCOME BREAKDOWN BY SOURCE ===');
  lines.push(`Membership Dues,${formatPaiseToINR(report.incomeBreakdown.duesCollectedPaise)}`);
  lines.push(`Event Ticket Sales,${formatPaiseToINR(report.incomeBreakdown.ticketSalesPaise)}`);
  lines.push(`Merchandise Revenue,${formatPaiseToINR(report.incomeBreakdown.merchandiseRevenuePaise)}`);
  lines.push(`Fundraiser Income,${formatPaiseToINR(report.incomeBreakdown.fundraiserIncomePaise)}`);
  lines.push(`Other Incomes,${formatPaiseToINR(report.incomeBreakdown.otherIncomePaise)}`);
  lines.push('');

  lines.push('=== 3. EXPENSES BY CATEGORY ===');
  lines.push('Category,Amount');
  for (const [cat, amt] of Object.entries(report.expensesByCategory)) {
    lines.push(`${cat},${formatPaiseToINR(amt)}`);
  }
  lines.push('');

  lines.push('=== 4. PER-EVENT FINANCIAL PERFORMANCE ===');
  lines.push('Event ID,Event Name,Date,Registrations,Revenue,Expenses,Net Profit/Loss');
  for (const ev of report.eventPerformance) {
    lines.push(
      `"${ev.eventId}","${ev.name.replace(/"/g, '""')}",${ev.date || 'TBD'},${ev.registrationCount},${formatPaiseToINR(ev.revenuePaise)},${formatPaiseToINR(ev.expensesPaise)},${formatPaiseToINR(ev.netResultPaise)}`
    );
  }
  lines.push('');

  lines.push('=== 5. VOLUNTEER CLAIMS QUEUE STATISTICS ===');
  lines.push(`Submitted Claims,${report.claimsStatistics.submittedCount}`);
  lines.push(`Approved (Pending Reimbursement),${report.claimsStatistics.approvedCount}`);
  lines.push(`Reimbursed Claims,${report.claimsStatistics.reimbursedCount}`);
  lines.push(`Rejected Claims,${report.claimsStatistics.rejectedCount}`);
  lines.push(`Total Unpaid Liabilities,${formatPaiseToINR(report.claimsStatistics.owedToVolunteersPaise)}`);
  lines.push('');

  lines.push('=== 6. CRYPTOGRAPHIC AUDIT INTEGRITY ===');
  lines.push(`Chain Integrity Status,${report.ledgerAudit.isChainValid ? 'VERIFIED_VALID' : 'TAMPERED_BROKEN'}`);
  lines.push(`Total Verified Entries,${report.ledgerAudit.totalLedgerEntries}`);
  lines.push(`Current Cryptographic Head Hash,${report.ledgerAudit.lastHeadHash}`);

  return lines.join('\n');
}

export function generateReportHTML(report: SemesterReportData): string {
  const inr = formatPaiseToINR;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SkylineOS Semester Financial Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; background: #ffffff; }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 20px; font-weight: bold; margin-top: 4px; color: #0f172a; }
    .green { color: #16a34a; }
    .red { color: #dc2626; }
    .purple { color: #9333ea; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; border-bottom: 1px solid #cbd5e1; font-weight: 600; }
    td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
    .section-title { font-size: 16px; font-weight: 700; margin: 24px 0 10px 0; color: #1e293b; }
    .audit-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; font-size: 13px; margin-top: 24px; }
    .hash { font-family: monospace; font-size: 11px; word-break: break-all; color: #15803d; }
  </style>
</head>
<body>
  <h1>SkylineOS Financial Audit & Semester Report</h1>
  <div class="meta">
    <div><strong>Organization:</strong> ${report.club?.name || 'SkylineOS All Clubs'}</div>
    <div><strong>Generated At:</strong> ${new Date(report.generatedAt).toLocaleString()}</div>
    <div><strong>Reporting Period:</strong> ${report.reportingPeriod.from || 'Genesis'} to ${report.reportingPeriod.to || 'Present'}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Opening Balance</div>
      <div class="kpi-value">${inr(report.vaultSummary.openingBalancePaise)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Income</div>
      <div class="kpi-value green">${inr(report.vaultSummary.totalIncomePaise)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total Expenses</div>
      <div class="kpi-value red">${inr(report.vaultSummary.totalExpensePaise)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Closing Vault Balance</div>
      <div class="kpi-value purple">${inr(report.vaultSummary.closingBalancePaise)}</div>
    </div>
  </div>

  <div class="section-title">Income by Category</div>
  <table>
    <thead><tr><th>Revenue Source</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Membership Dues</td><td>${inr(report.incomeBreakdown.duesCollectedPaise)}</td></tr>
      <tr><td>Event Ticket Sales</td><td>${inr(report.incomeBreakdown.ticketSalesPaise)}</td></tr>
      <tr><td>Merchandise Sales</td><td>${inr(report.incomeBreakdown.merchandiseRevenuePaise)}</td></tr>
      <tr><td>Fundraiser Income</td><td>${inr(report.incomeBreakdown.fundraiserIncomePaise)}</td></tr>
      <tr><td>Other Revenue</td><td>${inr(report.incomeBreakdown.otherIncomePaise)}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Per-Event Financial Performance</div>
  <table>
    <thead><tr><th>Event Name</th><th>Registrations</th><th>Revenue</th><th>Expenses</th><th>Net Profit / Loss</th></tr></thead>
    <tbody>
      ${report.eventPerformance.map(e => `
        <tr>
          <td><strong>${e.name}</strong></td>
          <td>${e.registrationCount}</td>
          <td class="green">${inr(e.revenuePaise)}</td>
          <td class="red">${inr(e.expensesPaise)}</td>
          <td style="font-weight: 600; color: ${e.netResultPaise >= 0 ? '#16a34a' : '#dc2626'};">${inr(e.netResultPaise)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="audit-box">
    <strong>🔒 Cryptographic Ledger Integrity:</strong> ${report.ledgerAudit.isChainValid ? '✅ INTACT & VERIFIED' : '❌ COMPROMISED'}<br/>
    <strong>Verified Entries:</strong> ${report.ledgerAudit.totalLedgerEntries}<br/>
    <strong>Head Hash:</strong> <span class="hash">${report.ledgerAudit.lastHeadHash}</span>
  </div>
</body>
</html>`;
}
