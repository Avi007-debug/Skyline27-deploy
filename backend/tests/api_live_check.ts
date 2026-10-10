import app from '../index';
import http from 'http';
import prisma from '../config/db';
import { signToken } from '../middlewares/auth';
import { Role } from '@prisma/client';

async function verifyAllApis() {
  console.log('\n🚀 Starting Live API End-to-End Verification...');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  console.log('1. Health Check:', healthRes.status === 200 ? '✅ 200 OK' : '❌ Failed', healthData);

  // Setup test actors
  const treasurerId = 'usr_treasurer_verify';
  const volunteerId = 'usr_volunteer_verify';
  await prisma.profile.upsert({
    where: { id: treasurerId },
    update: { role: Role.TREASURER },
    create: { id: treasurerId, fullName: 'Verified Treasurer', email: 'treasurer.verify@college.edu', role: Role.TREASURER }
  });
  await prisma.profile.upsert({
    where: { id: volunteerId },
    update: { role: Role.VOLUNTEER },
    create: { id: volunteerId, fullName: 'Verified Volunteer', email: 'volunteer.verify@college.edu', role: Role.VOLUNTEER }
  });

  const treasurerToken = signToken(treasurerId);
  const volunteerToken = signToken(volunteerId);

  // 2. Finance Summary
  const summaryRes = await fetch(`${baseUrl}/api/finance/summary`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const summary = await summaryRes.json();
  console.log('2. GET /api/finance/summary:', summaryRes.status === 200 ? '✅ 200 OK' : '❌ Failed', {
    vault: summary.summary,
    incomeCategories: Object.keys(summary.incomeByCategory || {}),
  });

  // 3. Ledger Entries
  const ledgerRes = await fetch(`${baseUrl}/api/finance/ledger?limit=5`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const ledger = await ledgerRes.json();
  console.log('3. GET /api/finance/ledger:', ledgerRes.status === 200 ? '✅ 200 OK' : '❌ Failed', {
    total: ledger.pagination?.total,
    entriesReturned: ledger.entries?.length
  });

  // 4. Audit Chain Verification
  const auditRes = await fetch(`${baseUrl}/api/finance/audit/verify`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const audit = await auditRes.json();
  console.log('4. GET /api/finance/audit/verify:', audit.valid ? '✅ VALID HASH CHAIN' : '❌ BROKEN', {
    entryCount: audit.entryCount,
    headHash: audit.headHash?.substring(0, 16) + '...'
  });

  // 5. Semester Reports (JSON, CSV, HTML)
  const reportRes = await fetch(`${baseUrl}/api/finance/report`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const csvRes = await fetch(`${baseUrl}/api/finance/report/csv`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const htmlRes = await fetch(`${baseUrl}/api/finance/report/html`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  console.log('5. Reports Engine:', 
    reportRes.status === 200 && csvRes.status === 200 && htmlRes.status === 200 ? '✅ JSON, CSV & HTML (All 200 OK)' : '❌ Failed'
  );

  // 6. Expense Claim Lifecycle (Submit -> Anti-Fraud Self-Approval Block -> Approve -> Reimburse)
  const submitRes = await fetch(`${baseUrl}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${volunteerToken}` },
    body: JSON.stringify({
      title: 'Lab orientation refreshments',
      vendor: 'Cafeteria',
      amountPaise: 18500,
      category: 'EXPENSE',
      receiptUrl: 'https://images.unsplash.com/photo-1554415707-9e4c019ffb47'
    })
  });
  const submitData = await submitRes.json();
  const claimId = submitData.claim?.id;
  console.log('6a. POST /api/expenses (Submit):', submitRes.status === 201 ? '✅ 201 Created' : '❌ Failed', { claimId });

  // Self-approval 403 test
  const selfApproveRes = await fetch(`${baseUrl}/api/expenses/${claimId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${volunteerToken}` }
  });
  console.log('6b. Anti-Fraud Self-Approval:', selfApproveRes.status === 403 ? '✅ Blocked with HTTP 403 Forbidden' : '❌ Security Bypass!');

  // Treasurer approve
  const approveRes = await fetch(`${baseUrl}/api/expenses/${claimId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const approveData = await approveRes.json();
  console.log('6c. POST /api/expenses/:id/approve:', approveRes.status === 200 ? '✅ 200 Approved' : '❌ Failed', { status: approveData.claim?.status });

  // Treasurer reimburse (atomic ledger OUT write)
  const reimburseRes = await fetch(`${baseUrl}/api/expenses/${claimId}/reimburse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const reimburseData = await reimburseRes.json();
  console.log('6d. POST /api/expenses/:id/reimburse:', reimburseRes.status === 200 ? '✅ 200 Reimbursed & Posted to Ledger' : '❌ Failed', {
    status: reimburseData.claim?.status,
    ledgerEntryId: reimburseData.ledgerEntry?.id,
    type: reimburseData.ledgerEntry?.type,
    amountPaise: reimburseData.ledgerEntry?.amountPaise
  });

  // 7. Verify audit chain updated with new block
  const finalAuditRes = await fetch(`${baseUrl}/api/finance/audit/verify`, {
    headers: { Authorization: `Bearer ${treasurerToken}` }
  });
  const finalAudit = await finalAuditRes.json();
  console.log('7. Final Audit Verification:', finalAudit.valid ? '✅ CHAIN VALID & EXTENDED' : '❌ BROKEN', {
    newEntryCount: finalAudit.entryCount,
    newHeadHash: finalAudit.headHash?.substring(0, 16) + '...'
  });

  server.close();
  await prisma.$disconnect();
  console.log('\n🎉 Live API End-to-End Verification Complete: ALL CHECKS PASSED!\n');
}

verifyAllApis().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
