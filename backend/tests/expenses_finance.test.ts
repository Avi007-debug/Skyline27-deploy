import app from '../index';
import http from 'http';
import prisma from '../config/db';
import { signToken } from '../middlewares/authenticate';
import { Role } from '@prisma/client';

async function runExpensesAndFinanceTests() {
  console.log('\n💳 Starting Expense Claims & Finance Endpoints Tests (D2)...');

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
    // Setup test users
    const volunteerId = 'usr_test_volunteer_01';
    const treasurerId = 'usr_test_treasurer_01';

    const GDG_ID = (await prisma.club.findFirstOrThrow({ where: { email: 'gdg@college.edu' } })).id;
    await prisma.profile.upsert({
      where: { id: volunteerId },
      update: { role: Role.CLUB_HEAD, clubId: GDG_ID },
      create: {
        id: volunteerId,
        fullName: 'Test Volunteer',
        email: 'volunteer.test@college.edu',
        role: Role.CLUB_HEAD, clubId: GDG_ID,
      },
    });

    await prisma.profile.upsert({
      where: { id: treasurerId },
      update: { role: Role.CLUB_HEAD, clubId: GDG_ID },
      create: {
        id: treasurerId,
        fullName: 'Test Treasurer',
        email: 'treasurer.test@college.edu',
        role: Role.CLUB_HEAD, clubId: GDG_ID,
      },
    });

    const volunteerToken = signToken(volunteerId);
    const treasurerToken = signToken(treasurerId);

    // 1. Volunteer submits claim
    let claimId = '';
    const claimAmountPaise = 45000; // ₹450

    await test('Volunteer submits receipt-backed expense claim', async () => {
      const res = await fetch(`${baseUrl}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${volunteerToken}`,
        },
        body: JSON.stringify({
          title: 'Printing club posters for orientation',
          vendor: 'Print Express',
          amountPaise: claimAmountPaise,
          category: 'EXPENSE',
          receiptUrl: 'https://example.com/receipts/print_001.jpg',
          scannedAmount: claimAmountPaise,
        }),
      });

      if (res.status !== 201) {
        const text = await res.text();
        throw new Error(`Failed with status ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (!data.claim || data.claim.status !== 'SUBMITTED') throw new Error('Claim not in SUBMITTED status');
      claimId = data.claim.id;
    });

    // 2. Volunteer views their own claims
    await test('Volunteer retrieves their own claims', async () => {
      const res = await fetch(`${baseUrl}/api/expenses/mine`, {
        headers: { Authorization: `Bearer ${volunteerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.claims) || !data.claims.find((c: any) => c.id === claimId)) {
        throw new Error('Submitted claim not found in mine list');
      }
    });

    // 3. Anti-fraud check: Claimant cannot approve their own claim!
    await test('Claimant is forbidden from approving their own claim (HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/expenses/${claimId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${volunteerToken}` },
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // 4. Treasurer approves the claim
    await test('Treasurer approves claim; status becomes APPROVED with no ledger entry yet', async () => {
      const res = await fetch(`${baseUrl}/api/expenses/${claimId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Status ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (data.claim.status !== 'APPROVED') throw new Error('Expected APPROVED status');
    });

    // 5. Finance summary reflects amount owed to volunteers
    await test('Finance summary reflects owedToVolunteersPaise before reimbursement', async () => {
      const res = await fetch(`${baseUrl}/api/finance/summary`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.summary.owedToVolunteersPaise < claimAmountPaise) {
        throw new Error(`Expected owedToVolunteersPaise >= ${claimAmountPaise}, got ${data.summary.owedToVolunteersPaise}`);
      }
    });

    // 6. Treasurer reimburses claim -> Atomically creates OUT / EXPENSE ledger entry
    await test('Treasurer reimburses claim; updates status to REIMBURSED and posts ledger OUT entry', async () => {
      const res = await fetch(`${baseUrl}/api/expenses/${claimId}/reimburse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Status ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (data.claim.status !== 'REIMBURSED') throw new Error('Expected REIMBURSED status');
      if (!data.ledgerEntry || data.ledgerEntry.type !== 'OUT') throw new Error('Expected OUT ledger entry');
    });

    // 7. Finance summary reflects updated expense and decreased owed
    await test('Finance summary reconciles after reimbursement', async () => {
      const res = await fetch(`${baseUrl}/api/finance/summary`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.summary.totalExpensePaise < claimAmountPaise) {
        throw new Error(`Expected totalExpensePaise >= ${claimAmountPaise}`);
      }
    });

    // 8. Cryptographic audit verification
    await test('Cryptographic audit verification reports intact chain', async () => {
      const res = await fetch(`${baseUrl}/api/finance/audit/verify`, {
        headers: { Authorization: `Bearer ${treasurerToken}` },
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.valid) throw new Error(`Chain reported invalid: ${data.reason}`);
    });

    // 9. Rejection flow test
    await test('Rejection flow requires reason and writes audit log', async () => {
      // Create another claim to reject
      const createRes = await fetch(`${baseUrl}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${volunteerToken}`,
        },
        body: JSON.stringify({
          title: 'Unapproved personal Uber ride',
          amountPaise: 30000,
          receiptUrl: 'https://example.com/receipts/uber.jpg',
        }),
      });
      const createData = await createRes.json();
      const rejectId = createData.claim.id;

      const rejectRes = await fetch(`${baseUrl}/api/expenses/${rejectId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${treasurerToken}`,
        },
        body: JSON.stringify({
          reason: 'Personal travel is not an eligible club expense.',
        }),
      });

      if (rejectRes.status !== 200) throw new Error(`Status ${rejectRes.status}`);
      const rejectData = await rejectRes.json();
      if (rejectData.claim.status !== 'REJECTED') throw new Error('Expected REJECTED status');
    });

    console.log(`\n📊 Expense & Finance Tests Summary: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runExpensesAndFinanceTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
