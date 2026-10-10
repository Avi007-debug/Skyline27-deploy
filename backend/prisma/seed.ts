import { RegistrationStatus, Role, ExpenseStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../config/db';
import { postLedger, verifyChain, GENESIS_HASH } from '../services/ledger';

dotenv.config();

async function main() {
  console.log(`\n🌱 Seeding database with SkylineOS Person D Financial System...`);

  // 1. Clean existing records in correct dependency order
  console.log('🧹 Cleaning existing test records...');

  // Disable ledger immutable trigger temporarily during cleanup
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
        ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_ledger_immutable;
      END IF;
    END $$;
  `).catch(() => {});

  await prisma.auditLog.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerHead.deleteMany();

  // Re-enable trigger
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
        ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable;
      END IF;
    END $$;
  `).catch(() => {});

  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.team.deleteMany();
  await prisma.event.deleteMany();
  await prisma.registrationKey.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.club.deleteMany();

  // 2. Initialize LedgerHead with 64-zero Genesis Hash
  console.log('⛓️ Initializing cryptographic LedgerHead...');
  await prisma.ledgerHead.create({
    data: {
      id: 1,
      lastHash: GENESIS_HASH,
    },
  });

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 3. Create Clubs (GDG, Rotaract, IEEE)
  console.log('🏛️ Creating clubs...');
  const gdgClub = await prisma.club.create({
    data: {
      name: 'Google Developer Groups on Campus (GDG)',
      email: 'gdg@college.edu',
      password: hashedPassword,
      logoUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=200&h=200&fit=crop',
      qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=gdg@okaxis&pn=GDG%20Campus',
      upiId: 'gdg@okaxis',
    },
  });

  const rotaractClub = await prisma.club.create({
    data: {
      name: 'Rotaract Club of Skyline',
      email: 'rotaract@college.edu',
      password: hashedPassword,
      logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=200&h=200&fit=crop',
      qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=rotaract@okaxis&pn=Rotaract%20Skyline',
      upiId: 'rotaract@okaxis',
    },
  });

  const ieeeClub = await prisma.club.create({
    data: {
      name: 'IEEE Student Branch',
      email: 'ieee@college.edu',
      password: hashedPassword,
      logoUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=200&h=200&fit=crop',
      qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=ieee@okhdfcbank&pn=IEEE%20Branch',
      upiId: 'ieee@okhdfcbank',
    },
  });

  // 4. Create User Profiles with explicit Roles
  console.log('👤 Creating role-based profiles (ADMIN, TREASURER, VOLUNTEER, MEMBER)...');
  const gdgLead = await prisma.profile.create({
    data: {
      id: 'usr_gdg_lead_01',
      fullName: 'Aarav Sharma (GDG Lead)',
      email: 'aarav.gdg@college.edu',
      password: hashedPassword,
      usn: '1MS22CS001',
      branch: 'Computer Science and Engineering',
      phone: '+91 9876543210',
      year: 3,
      sem: 6,
      clubId: gdgClub.id,
      role: Role.ADMIN,
    },
  });

  const gdgTreasurer = await prisma.profile.create({
    data: {
      id: 'usr_gdg_treasurer_01',
      fullName: 'Ananya Rao (GDG Treasurer)',
      email: 'ananya.treasurer@college.edu',
      password: hashedPassword,
      usn: '1MS22CS015',
      branch: 'Computer Science and Engineering',
      phone: '+91 9876543220',
      year: 3,
      sem: 6,
      clubId: gdgClub.id,
      role: Role.TREASURER,
    },
  });

  const gdgVolunteer = await prisma.profile.create({
    data: {
      id: 'usr_gdg_volunteer_01',
      fullName: 'Karthik Verma (GDG Volunteer)',
      email: 'karthik.volunteer@college.edu',
      password: hashedPassword,
      usn: '1MS23CS088',
      branch: 'Computer Science and Engineering',
      phone: '+91 9876543230',
      year: 2,
      sem: 4,
      clubId: gdgClub.id,
      role: Role.VOLUNTEER,
    },
  });

  const student1 = await prisma.profile.create({
    data: {
      id: 'usr_student_01',
      fullName: 'Priya Nair',
      email: 'priya.nair@college.edu',
      password: hashedPassword,
      usn: '1MS23IS045',
      branch: 'Information Science and Engineering',
      phone: '+91 9876543211',
      year: 2,
      sem: 4,
      role: Role.MEMBER,
    },
  });

  const student2 = await prisma.profile.create({
    data: {
      id: 'usr_student_02',
      fullName: 'Rohan Gupta',
      email: 'rohan.gupta@college.edu',
      password: hashedPassword,
      usn: '1MS23AI012',
      branch: 'Artificial Intelligence & Data Science',
      phone: '+91 9876543212',
      year: 2,
      sem: 4,
      role: Role.MEMBER,
    },
  });

  // 5. Create Events
  console.log('📅 Creating events...');
  const gdgEvent = await prisma.event.create({
    data: {
      clubId: gdgClub.id,
      name: 'Cloud & GenAI DevFest 2026',
      description: 'Join GDG on Campus for an immersive hands-on day covering Google Cloud Platform, Vertex AI, Gemini APIs, and full-stack cloud deployments with live mentors and swag.',
      eventType: 'TECHNICAL',
      fee: 150,
      registrationLimit: 120,
      registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      eventEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      venue: 'Auditorium 1, Tech Block',
      teamSizeLimit: 3,
      minTeamSize: 1,
      upiId: 'gdg@okaxis',
      bannerUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop',
      qrUrl: gdgClub.qrUrl,
    },
  });

  const rotaractEvent = await prisma.event.create({
    data: {
      clubId: rotaractClub.id,
      name: 'Skyline Youth Impact Summit',
      description: 'An inspiring leadership conference featuring keynote entrepreneurs, social innovation challenges, and networking panels.',
      eventType: 'WORKSHOP',
      fee: 50,
      registrationLimit: 200,
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      eventDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      venue: 'Main Seminar Hall',
      teamSizeLimit: 1,
      minTeamSize: 1,
      upiId: 'rotaract@okaxis',
      bannerUrl: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&h=600&fit=crop',
      qrUrl: rotaractClub.qrUrl,
    },
  });

  const ieeeEvent = await prisma.event.create({
    data: {
      clubId: ieeeClub.id,
      name: 'HackMatrix 24-Hour Hackathon',
      description: 'Build cutting-edge Web3, IoT, and AI solutions in a 24-hour sprint. Cash prizes worth ₹50,000 + internship opportunities for winners.',
      eventType: 'HACKATHON',
      fee: 250,
      registrationLimit: 60,
      registrationDeadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      venue: 'CSE Advanced Computing Labs',
      teamSizeLimit: 4,
      minTeamSize: 2,
      upiId: 'ieee@okhdfcbank',
      bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=600&fit=crop',
      qrUrl: ieeeClub.qrUrl,
    },
  });

  // 6. Create Teams & Registrations
  console.log('🤝 Creating teams and registrations...');
  const devFestTeam = await prisma.team.create({
    data: {
      eventId: gdgEvent.id,
      teamName: 'ByteForce',
      passkey: 'BF2026',
      leaderId: student1.id,
    },
  });

  await prisma.registration.create({
    data: {
      eventId: gdgEvent.id,
      userId: student1.id,
      teamId: devFestTeam.id,
      status: RegistrationStatus.CONFIRMED,
      transactionId: 'UPI-TXN-98472910382',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      checkedInAt: new Date(),
    },
  });

  await prisma.registration.create({
    data: {
      eventId: rotaractEvent.id,
      userId: student2.id,
      status: RegistrationStatus.CONFIRMED,
      transactionId: 'UPI-TXN-11928471928',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
    },
  });

  // 7. Seed Expense Claims in all four lifecyle states
  console.log('🧾 Creating multi-state expense claims...');
  const reimbursedClaim = await prisma.expenseClaim.create({
    data: {
      id: 'claim_seed_reimbursed_01',
      clubId: gdgClub.id,
      claimantId: gdgVolunteer.id,
      title: 'DevFest Stage Banners & Standees',
      vendor: 'PrintHub Digital Solutions',
      amountPaise: 12500, // ₹125.00
      scannedAmount: 12500,
      mismatchFlag: false,
      category: 'EXPENSE',
      eventId: gdgEvent.id,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      status: ExpenseStatus.REIMBURSED,
      approverId: gdgTreasurer.id,
      decisionNote: 'Verified original invoice and reimbursed via IMPS.',
      reimbursedAt: new Date(),
    },
  });

  const approvedClaim = await prisma.expenseClaim.create({
    data: {
      id: 'claim_seed_approved_01',
      clubId: gdgClub.id,
      claimantId: gdgVolunteer.id,
      title: 'HDMI to Type-C Adapters (x2) for Workshop',
      vendor: 'Croma Electronics',
      amountPaise: 40000, // ₹400.00
      scannedAmount: 40000,
      mismatchFlag: false,
      category: 'EXPENSE',
      eventId: gdgEvent.id,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      status: ExpenseStatus.APPROVED,
      approverId: gdgTreasurer.id,
      decisionNote: 'Approved. Disbursing in next weekly reimbursement batch.',
    },
  });

  const submittedClaim = await prisma.expenseClaim.create({
    data: {
      id: 'claim_seed_submitted_01',
      clubId: gdgClub.id,
      claimantId: gdgVolunteer.id,
      title: 'Volunteer Lanyards & Name Badges',
      vendor: 'Campus Print Corner',
      amountPaise: 25000, // ₹250.00
      scannedAmount: 28000, // OCR scanned mismatch!
      mismatchFlag: true,
      category: 'EXPENSE',
      eventId: gdgEvent.id,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      status: ExpenseStatus.SUBMITTED,
    },
  });

  const rejectedClaim = await prisma.expenseClaim.create({
    data: {
      id: 'claim_seed_rejected_01',
      clubId: gdgClub.id,
      claimantId: gdgVolunteer.id,
      title: 'Late Night Cab from Home to Campus',
      vendor: 'Uber India Technologies',
      amountPaise: 60000, // ₹600.00
      scannedAmount: 60000,
      mismatchFlag: false,
      category: 'EXPENSE',
      eventId: gdgEvent.id,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      status: ExpenseStatus.REJECTED,
      approverId: gdgTreasurer.id,
      decisionNote: 'Personal transportation expenses cannot be reimbursed per college finance policy.',
    },
  });

  // 8. Seed Immutable Cryptographic Ledger Entries via postLedger
  console.log('💎 Seeding audited ledger entries into SHA-256 hash chain...');

  // 8.1 Membership Dues (IN)
  await postLedger({
    clubId: gdgClub.id,
    type: 'IN',
    category: 'DUES',
    amountPaise: 50000, // ₹500.00
    refType: 'MEMBERSHIP_DUES',
    refId: `dues_${student1.id}`,
    actorId: student1.id,
    memo: 'Annual GDG Campus Membership Dues - Priya Nair',
  });

  // 8.2 Ticket Sale for DevFest (IN)
  await postLedger({
    clubId: gdgClub.id,
    type: 'IN',
    category: 'TICKET',
    amountPaise: 15000, // ₹150.00
    refType: 'TICKET_SALE',
    refId: `ticket_${gdgEvent.id}_${student1.id}`,
    eventId: gdgEvent.id,
    actorId: student1.id,
    memo: 'Cloud DevFest 2026 Ticket - Priya Nair (ByteForce)',
  });

  // 8.3 Merch Sale (IN)
  await postLedger({
    clubId: gdgClub.id,
    type: 'IN',
    category: 'MERCH',
    amountPaise: 45000, // ₹450.00
    refType: 'MERCH_SALE',
    refId: 'merch_ord_9901',
    actorId: student2.id,
    memo: 'Skyline GDG Developer Hoodie (Navy Blue, M)',
  });

  // 8.4 Fundraiser / Sponsorship (IN)
  await postLedger({
    clubId: gdgClub.id,
    type: 'IN',
    category: 'FUNDRAISER',
    amountPaise: 100000, // ₹1,000.00
    refType: 'FUNDRAISER_DONATION',
    refId: 'fund_corp_sponsor_01',
    clubId: gdgClub.id,
    actorId: gdgLead.id,
    memo: 'Industry Seed Grant - Alumni DevTech Fund',
  });

  // 8.5 Reimbursed Expense (OUT) - linking to reimbursedClaim
  await postLedger({
    clubId: gdgClub.id,
    type: 'OUT',
    category: 'EXPENSE',
    amountPaise: reimbursedClaim.amountPaise, // 12500 paise (₹125.00)
    refType: 'EXPENSE_REIMBURSEMENT',
    refId: reimbursedClaim.id,
    eventId: gdgEvent.id,
    actorId: gdgTreasurer.id,
    memo: `Reimbursement for Claim #${reimbursedClaim.id}: ${reimbursedClaim.title}`,
  });

  // 9. Create Registration Keys
  console.log('🔑 Creating registration keys...');
  await prisma.registrationKey.createMany({
    data: [
      {
        code: 'GDG-CAMPUS-2026',
        isUsed: true,
        usedByClubId: gdgClub.id,
        usedAt: new Date(),
      },
      {
        code: 'ROTARACT-SKYLINE-KEY',
        isUsed: true,
        usedByClubId: rotaractClub.id,
        usedAt: new Date(),
      },
      {
        code: 'IEEE-STUDENT-BRANCH',
        isUsed: true,
        usedByClubId: ieeeClub.id,
        usedAt: new Date(),
      },
      {
        code: 'SKYLINE-INVITE-DEV-01',
        isUsed: false,
      },
      {
        code: 'SKYLINE-INVITE-DEV-02',
        isUsed: false,
      },
    ],
  });

  // 10. Create Notifications
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: student1.id,
        eventId: gdgEvent.id,
        type: 'REGISTRATION_CONFIRMED',
        title: 'Registration Confirmed for Cloud & GenAI DevFest 2026',
        body: 'Your registration for Cloud & GenAI DevFest 2026 with team ByteForce has been approved by GDG!',
        isRead: false,
      },
      {
        userId: gdgVolunteer.id,
        type: 'CLAIM_STATUS_UPDATED',
        title: 'Expense Claim Reimbursed',
        body: 'Your claim for "DevFest Stage Banners" of ₹125.00 has been reimbursed by the Treasurer.',
        isRead: false,
      },
      {
        userId: student2.id,
        eventId: rotaractEvent.id,
        type: 'REGISTRATION_CONFIRMED',
        title: 'Welcome to Skyline Youth Impact Summit',
        body: 'Your ticket has been confirmed. Please bring your college ID card on the event day.',
        isRead: true,
      },
    ],
  });

  // 11. Verify Cryptographic Integrity
  console.log('🔒 Verifying ledger chain integrity...');
  const chainAudit = await verifyChain();
  if (!chainAudit.valid) {
    throw new Error(`Ledger integrity check failed during seed! Reason: ${chainAudit.reason}`);
  }

  console.log(`✅ Ledger Chain Intact: ${chainAudit.entryCount} entries verified with Head: ${chainAudit.headHash.slice(0, 16)}...`);
  console.log('\n✨ Database seeding completed successfully with full Person D financial architecture!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
