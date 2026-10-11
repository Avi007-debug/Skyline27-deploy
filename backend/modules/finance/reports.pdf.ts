import PDFDocument from 'pdfkit';
import { SemesterReportData, formatPaiseToINR as inr } from './reports.service';

const INK = '#17171a';
const MUTED = '#63635e';
const LINE = '#d9d8d4';
const FILL = '#f1f0ef';

/**
 * The semester financial report as a real PDF (A4). Built with a standard font, so amounts are
 * written as "INR 1,234.00" rather than with the rupee sign.
 */
export function generateReportPDF(report: SemesterReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'SkylineOS Financial Report', Author: 'SkylineOS' } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const room = (h: number) => {
      if (doc.y + h > bottom()) doc.addPage();
    };

    const heading = (text: string) => {
      room(60);
      doc.moveDown(0.9).font('Helvetica-Bold').fontSize(12).fillColor(INK).text(text, left, doc.y);
      doc.moveDown(0.3);
    };

    /** A simple table: header row, then rows. `widths` are fractions of the page width. */
    const table = (head: string[], rows: string[][], widths: number[], rightFrom = 1) => {
      const cols = widths.map(w => w * width);
      const draw = (cells: string[], bold: boolean, shade: boolean) => {
        const heights = cells.map((c, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).heightOfString(c, { width: cols[i] - 12 }));
        const h = Math.max(...heights) + 10;
        room(h);
        const y = doc.y;
        if (shade) doc.rect(left, y, width, h).fill(FILL);
        let x = left;
        cells.forEach((c, i) => {
          doc.fillColor(bold ? MUTED : INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
            .text(c, x + 6, y + 5, { width: cols[i] - 12, align: i >= rightFrom ? 'right' : 'left' });
          x += cols[i];
        });
        doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
        doc.y = y + h;
      };
      draw(head, true, true);
      if (rows.length === 0) draw(['Nothing to show for this period.', ...head.slice(1).map(() => '')], false, false);
      rows.forEach(r => draw(r, false, false));
    };

    // Title block
    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text('Financial report', left, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).moveDown(0.3);
    doc.text(report.club?.name ?? 'All clubs');
    doc.text(`Period: ${report.reportingPeriod.from ?? 'Start'} to ${report.reportingPeriod.to ?? 'Present'}`);
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`);

    // Summary
    heading('Summary');
    const v = report.vaultSummary;
    table(['Item', 'Amount'], [
      ['Opening balance', inr(v.openingBalancePaise)],
      ['Total income', inr(v.totalIncomePaise)],
      ['Total expenses', inr(v.totalExpensePaise)],
      ['Closing balance', inr(v.closingBalancePaise)],
      ['Owed to volunteers (approved, unpaid)', inr(v.owedToVolunteersPaise)],
    ], [0.65, 0.35]);

    heading('Income by source');
    const i = report.incomeBreakdown;
    table(['Source', 'Amount'], [
      ['Membership dues', inr(i.duesCollectedPaise)],
      ['Ticket sales', inr(i.ticketSalesPaise)],
      ['Merchandise', inr(i.merchandiseRevenuePaise)],
      ['Fundraisers', inr(i.fundraiserIncomePaise)],
      ['Other', inr(i.otherIncomePaise)],
    ], [0.65, 0.35]);

    heading('Expenses by category');
    table(['Category', 'Amount'], Object.entries(report.expensesByCategory).map(([k, amt]) => [k, inr(amt)]), [0.65, 0.35]);

    heading('Event performance');
    table(
      ['Event', 'Date', 'Registered', 'Revenue', 'Expenses', 'Net'],
      report.eventPerformance.map(e => [e.name, e.date ? String(e.date).slice(0, 10) : '-', String(e.registrationCount), inr(e.revenuePaise), inr(e.expensesPaise), inr(e.netResultPaise)]),
      [0.27, 0.13, 0.12, 0.16, 0.16, 0.16],
      2
    );

    heading('Expense claims');
    const c = report.claimsStatistics;
    table(['Status', 'Count'], [
      ['Submitted', String(c.submittedCount)],
      ['Approved', String(c.approvedCount)],
      ['Rejected', String(c.rejectedCount)],
      ['Reimbursed', String(c.reimbursedCount)],
    ], [0.65, 0.35]);

    heading('Ledger integrity');
    doc.font('Helvetica').fontSize(9).fillColor(INK)
      .text(`${report.ledgerAudit.isChainValid ? 'Verified: the ledger chain is intact.' : 'WARNING: the ledger chain failed verification.'}  Entries: ${report.ledgerAudit.totalLedgerEntries}`, left, doc.y, { width });
    doc.font('Courier').fontSize(7.5).fillColor(MUTED).text(`Head hash: ${report.ledgerAudit.lastHeadHash}`, left, doc.y + 2, { width });

    doc.end();
  });
}
