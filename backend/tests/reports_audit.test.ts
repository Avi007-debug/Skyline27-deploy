import app from '../index';
import http from 'http';
import prisma from '../config/db';
import { signToken } from '../middlewares/authenticate';
import { Role } from '@prisma/client';

async function runReportsAndAuditTests() {
  console.log('\n📊 Starting Semester Reports & DB Constraints Tests (D3/D4)...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };

  try {
    const treasurerId = 'usr_test_treasurer_rep';
    const GDG_ID = (await prisma.club.findFirstOrThrow({ where: { email: 'gdg@college.edu' } })).id;
    await prisma.profile.upsert({
      where: { id: treasurerId },
      update: { role: Role.CLUB_HEAD, clubId: GDG_ID },
      create: {
        id: treasurerId,
        fullName: 'Treasurer Reporter',
        email: 'treasurer.rep@college.edu',
        role: Role.CLUB_HEAD, clubId: GDG_ID,
      },
    });
    const treasurerToken = signToken(treasurerId);

    // 1. Test Append-Only Trigger blocks UPDATE
    await test('PostgreSQL trigger strictly blocks UPDATE on LedgerEntry', async () => {
      const entry = await prisma.ledgerEntry.findFirst();
      if (entry) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "LedgerEntry" SET amount_paise = 999999 WHERE id = ${entry.id}`
          );
          throw new Error('Trigger failed: UPDATE was allowed!');
        } catch (err: any) {
          if (!err.message.includes('immutable and append-only')) {
            throw err;
          }
        }
      }
    });

    // 2. Test Append-Only Trigger blocks DELETE
    await test('PostgreSQL trigger strictly blocks DELETE on LedgerEntry', async () => {
      const entry = await prisma.ledgerEntry.findFirst();
      if (entry) {
        try {
          await prisma.$executeRawUnsafe(
            `DELETE FROM "LedgerEntry" WHERE id = ${entry.id}`
          );
          throw new Error('Trigger failed: DELETE was allowed!');
        } catch (err: any) {
          if (!err.message.includes('immutable and append-only')) {
            throw err;
          }
        }
      }
    });

    // 3. Test Reporting Views
    await test('PostgreSQL reporting views return aggregated data', async () => {
      const viewResult: any = await prisma.$queryRawUnsafe(`
        SELECT * FROM v_ledger_by_category LIMIT 5;
      `);
      if (!Array.isArray(viewResult)) throw new Error('Expected array from v_ledger_by_category');
    });

    // 4. Test GET /api/finance/report (JSON)
    await test('GET /api/finance/report returns complete semester report JSON', async () => {
      const res = await fetch(`${baseUrl}/api/finance/report`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.report || !data.report.vaultSummary || !data.report.incomeBreakdown) {
        throw new Error('Malformed semester report JSON');
      }
    });

    // 5. Test GET /api/finance/report/csv
    await test('GET /api/finance/report/csv returns formatted CSV export', async () => {
      const res = await fetch(`${baseUrl}/api/finance/report/csv`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const csv = await res.text();
      if (!csv.includes('SKYLINEOS TREASURER SEMESTER FINANCIAL REPORT') || !csv.includes('VAULT & BALANCE')) {
        throw new Error('Malformed CSV output');
      }
    });

    // 6. Test GET /api/finance/report/html
    await test('GET /api/finance/report/html returns print-ready document', async () => {
      const res = await fetch(`${baseUrl}/api/finance/report/html`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const html = await res.text();
      if (!html.includes('SkylineOS Financial Audit & Semester Report')) {
        throw new Error('Malformed HTML output');
      }
    });

    console.log(`\n📊 Reports & Audit Tests Summary: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runReportsAndAuditTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
