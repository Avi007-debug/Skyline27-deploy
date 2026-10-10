import { postLedger, verifyChain, GENESIS_HASH } from '../services/ledger';
import prisma from '../config/db';

async function runLedgerTests() {
  console.log('\n🔒 Starting Cryptographic Financial Ledger Tests (D1)...');

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

  // Reset test ledger
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerHead.deleteMany();

  // Test 1: Genesis verify
  await test('Empty ledger verifies against genesis hash', async () => {
    const res = await verifyChain();
    if (!res.valid) throw new Error('Expected empty ledger to be valid');
    if (res.headHash !== GENESIS_HASH) throw new Error('Expected head to match genesis hash');
  });

  // Test 2: Validation of invalid amounts
  await test('Rejects non-positive, zero or fractional amounts', async () => {
    try {
      await postLedger({
        type: 'IN',
        category: 'DUES',
        amountPaise: 0,
        refType: 'test',
        refId: 'zero',
      });
      throw new Error('Should have rejected amount 0');
    } catch (e: any) {
      if (!e.message.includes('positive integer')) throw e;
    }

    try {
      await postLedger({
        type: 'IN',
        category: 'DUES',
        amountPaise: -100,
        refType: 'test',
        refId: 'negative',
      });
      throw new Error('Should have rejected negative amount');
    } catch (e: any) {
      if (!e.message.includes('positive integer')) throw e;
    }

    try {
      await postLedger({
        type: 'IN',
        category: 'DUES',
        amountPaise: 12.5,
        refType: 'test',
        refId: 'fractional',
      });
      throw new Error('Should have rejected fractional amount');
    } catch (e: any) {
      if (!e.message.includes('positive integer')) throw e;
    }
  });

  // Test 3: Normal Post Ledger & Chain Link
  let entry1: any;
  let entry2: any;
  await test('Posts valid IN and OUT transactions and chains hashes', async () => {
    const res1 = await postLedger({
      type: 'IN',
      category: 'DUES',
      amountPaise: 50000, // ₹500
      refType: 'membership',
      refId: 'mem_001',
      memo: 'Annual club membership dues',
    });
    entry1 = res1.entry;
    if (res1.isDuplicate) throw new Error('Should not be duplicate');
    if (entry1.prevHash !== GENESIS_HASH) throw new Error('Entry 1 prevHash should be genesis');

    const res2 = await postLedger({
      type: 'OUT',
      category: 'EXPENSE',
      amountPaise: 12500, // ₹125
      refType: 'expense',
      refId: 'exp_001',
      memo: 'Event snacks reimbursement',
    });
    entry2 = res2.entry;
    if (entry2.prevHash !== entry1.hash) throw new Error('Entry 2 prevHash must match Entry 1 hash');

    const verify = await verifyChain();
    if (!verify.valid) throw new Error(`Chain failed verification: ${verify.reason}`);
    if (verify.entryCount !== 2) throw new Error(`Expected 2 entries, found ${verify.entryCount}`);
    if (verify.headHash !== entry2.hash) throw new Error('LedgerHead must match entry2 hash');
  });

  // Test 4: Idempotency (duplicate write does not double-count)
  await test('Duplicate write with same refType/refId/type is idempotent', async () => {
    const res = await postLedger({
      type: 'IN',
      category: 'DUES',
      amountPaise: 50000,
      refType: 'membership',
      refId: 'mem_001',
    });

    if (!res.isDuplicate) throw new Error('Expected isDuplicate to be true');
    if (res.entry.id !== entry1.id) throw new Error('Expected existing entry ID');

    const verify = await verifyChain();
    if (!verify.valid || verify.entryCount !== 2) throw new Error('Duplicate write corrupted count');
  });

  // Test 5: Concurrency - 20 concurrent distinct transactions
  await test('20 concurrent writes succeed without collision and form valid chain', async () => {
    const promises = [];
    for (let i = 1; i <= 20; i++) {
      promises.push(
        postLedger({
          type: i % 2 === 0 ? 'IN' : 'OUT',
          category: i % 3 === 0 ? 'TICKET' : 'MERCH',
          amountPaise: 1000 * i,
          refType: 'concurrent_batch',
          refId: `batch_${i}`,
          memo: `Concurrent test item #${i}`,
        })
      );
    }

    const results = await Promise.all(promises);
    if (results.length !== 20) throw new Error('Expected 20 results');

    const verify = await verifyChain();
    if (!verify.valid) throw new Error(`Concurrent chain failed verification: ${verify.reason}`);
    if (verify.entryCount !== 22) throw new Error(`Expected 22 total entries, found ${verify.entryCount}`);
  });

  // Test 6: Concurrent identical writes create only one entry
  await test('Concurrent identical requests create only one ledger entry', async () => {
    const identicalReqs = Array(5).fill(null).map(() =>
      postLedger({
        type: 'IN',
        category: 'FUNDRAISER',
        amountPaise: 25000,
        refType: 'identical_test',
        refId: 'race_cond_01',
        memo: 'Simultaneous duplicate test',
      })
    );

    const raceResults = await Promise.all(identicalReqs);
    const createdCount = raceResults.filter(r => !r.isDuplicate).length;
    const dupCount = raceResults.filter(r => r.isDuplicate).length;

    if (createdCount !== 1) throw new Error(`Expected exactly 1 new entry, got ${createdCount}`);
    if (dupCount !== 4) throw new Error(`Expected 4 duplicates, got ${dupCount}`);

    const verify = await verifyChain();
    if (!verify.valid) throw new Error(`Chain broke under identical race condition: ${verify.reason}`);
  });

  console.log(`\n📊 Ledger Tests Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runLedgerTests()
  .catch(err => {
    console.error('Fatal ledger test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
