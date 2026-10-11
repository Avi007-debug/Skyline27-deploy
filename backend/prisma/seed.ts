import { RegistrationStatus, Role, ExpenseStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../config/db';
import { postLedger, verifyChain, GENESIS_HASH } from '../modules/finance/ledger.service';

dotenv.config();

async function main() {
  console.log(`\n🌱 Seeding database with SkylineOS Unified Campus Platform (10 Clubs, 50 Events, 50 Merch Products)...`);

  // ── 1. Clean existing records in correct dependency order ───────────────────
  console.log('🧹 Cleaning existing test records...');

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

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
        ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable;
      END IF;
    END $$;
  `).catch(() => {});

  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.savedEvent.deleteMany();
  await prisma.eventTask.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.team.deleteMany();
  await prisma.event.deleteMany();
  await prisma.registrationKey.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.club.deleteMany();

  // ── 2. Initialize LedgerHead with 64-zero Genesis Hash ──────────────────────
  console.log('⛓️ Initializing cryptographic LedgerHead...');
  await prisma.ledgerHead.create({
    data: { id: 1, lastHash: GENESIS_HASH },
  });

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // ── 3. Create 10 Distinct Campus Clubs ───────────────────────────────────────
  console.log('🏛️ Creating 10 clubs...');
  const clubDefinitions = [
    {
      id: 'club_gdg_01',
      name: 'Google Developer Groups on Campus (GDG)',
      email: 'gdg@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=300&h=300&fit=crop',
      upiId: 'gdg@okaxis',
      membershipFeePaise: 49900, // ₹499
      membershipMonths: 12,
    },
    {
      id: 'club_rotaract_02',
      name: 'Rotaract Club of Skyline',
      email: 'rotaract@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=300&h=300&fit=crop',
      upiId: 'rotaract@okaxis',
      membershipFeePaise: 29900, // ₹299
      membershipMonths: 12,
    },
    {
      id: 'club_ieee_03',
      name: 'IEEE Student Branch',
      email: 'ieee@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=300&h=300&fit=crop',
      upiId: 'ieee@okhdfcbank',
      membershipFeePaise: 59900, // ₹599
      membershipMonths: 12,
    },
    {
      id: 'club_acm_04',
      name: 'ACM Student Chapter',
      email: 'acm@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=300&fit=crop',
      upiId: 'acm@okaxis',
      membershipFeePaise: 39900,
      membershipMonths: 12,
    },
    {
      id: 'club_design_05',
      name: 'Design & Creative Arts Guild (DCAG)',
      email: 'design@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300&h=300&fit=crop',
      upiId: 'design@okicici',
      membershipFeePaise: 24900,
      membershipMonths: 12,
    },
    {
      id: 'club_opensource_06',
      name: 'Skyline Open Source & Linux Club',
      email: 'opensource@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=300&h=300&fit=crop',
      upiId: 'opensource@oksbi',
      membershipFeePaise: 19900,
      membershipMonths: 12,
    },
    {
      id: 'club_ecell_07',
      name: 'E-Cell (Entrepreneurship Cell)',
      email: 'ecell@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=300&h=300&fit=crop',
      upiId: 'ecell@okaxis',
      membershipFeePaise: 34900,
      membershipMonths: 12,
    },
    {
      id: 'club_robotics_08',
      name: 'Robotics & Automation Society',
      email: 'robotics@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&h=300&fit=crop',
      upiId: 'robotics@okhdfcbank',
      membershipFeePaise: 44900,
      membershipMonths: 12,
    },
    {
      id: 'club_music_09',
      name: 'Music & Performing Arts Society (Acoustix)',
      email: 'music@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
      upiId: 'acoustix@okaxis',
      membershipFeePaise: 29900,
      membershipMonths: 12,
    },
    {
      id: 'club_litsoc_10',
      name: 'Literary & Debating Society (LitSoc)',
      email: 'litsoc@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=300&h=300&fit=crop',
      upiId: 'litsoc@okicici',
      membershipFeePaise: 19900,
      membershipMonths: 12,
    },
  ];

  const clubs: Record<string, any> = {};
  for (const c of clubDefinitions) {
    clubs[c.id] = await prisma.club.create({
      data: {
        id: c.id,
        name: c.name,
        email: c.email,
        password: hashedPassword,
        logoUrl: c.logoUrl,
        upiId: c.upiId,
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=${encodeURIComponent(c.upiId)}&pn=${encodeURIComponent(c.name)}`,
        membershipFeePaise: c.membershipFeePaise,
        membershipMonths: c.membershipMonths,
      },
    });
  }

  // ── 4. Create User Profiles (Admin, Club Heads, Students) ───────────────────
  console.log('👤 Creating role-based profiles...');

  // Super Admin
  const superAdmin = await prisma.profile.create({
    data: {
      id: 'usr_super_admin_01',
      fullName: 'Skyline Super Admin',
      email: 'admin@skyline.local',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  // Demo Student (Primary account for grading / browsing)
  const demoStudent = await prisma.profile.create({
    data: {
      id: 'usr_student_demo_01',
      fullName: 'Alex Rivera',
      email: 'student@college.edu',
      password: hashedPassword,
      usn: '1SK23CS042',
      branch: 'Computer Science and Engineering',
      phone: '+91 9876543210',
      year: 3,
      sem: 5,
      role: Role.STUDENT,
    },
  });

  // Extra Students for Teams and Peer Registrations
  const studentPriya = await prisma.profile.create({
    data: {
      id: 'usr_student_02',
      fullName: 'Priya Nair',
      email: 'priya.nair@college.edu',
      password: hashedPassword,
      usn: '1SK23IS015',
      branch: 'Information Science & Engineering',
      phone: '+91 9876543211',
      year: 3,
      sem: 5,
      role: Role.STUDENT,
    },
  });

  const studentRohan = await prisma.profile.create({
    data: {
      id: 'usr_student_03',
      fullName: 'Rohan Gupta',
      email: 'rohan.gupta@college.edu',
      password: hashedPassword,
      usn: '1SK23AI088',
      branch: 'Artificial Intelligence & Data Science',
      phone: '+91 9876543212',
      year: 2,
      sem: 3,
      role: Role.STUDENT,
    },
  });

  // Create a Club Head for each club
  const clubHeadProfiles: Record<string, any> = {};
  for (const c of clubDefinitions) {
    clubHeadProfiles[c.id] = await prisma.profile.create({
      data: {
        id: `usr_head_${c.id}`,
        fullName: `${c.name.split(' ')[0]} Lead`,
        email: `head.${c.email}`,
        password: hashedPassword,
        clubId: c.id,
        role: Role.CLUB_HEAD,
      },
    });
  }

  // Active membership for Alex Rivera in GDG
  await prisma.membership.create({
    data: {
      userId: demoStudent.id,
      clubId: clubs['club_gdg_01'].id,
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      duesPaidPaise: 49900,
      transactionId: 'TXN-GDG-DUES-ALEX-01',
      verifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ── 5. Create 50 Distinct Events Across 10 Clubs ─────────────────────────────
  console.log('📅 Generating 50 events (today, ongoing, upcoming, and past)...');

  const now = new Date();
  const createdEvents: any[] = [];

  // Helper date generators relative to today
  const todayHour = (hourOffset: number) => new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
  const daysOffset = (days: number, hourOfDay = 10) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hourOfDay, 0, 0, 0);
    return d;
  };

  // Event templates for each club (5 events per club = 50 total)
  const eventBlueprints = [
    // ── 1. GDG on Campus (5 events)
    {
      clubKey: 'club_gdg_01',
      name: 'Google Cloud & Vertex AI DevFest',
      desc: 'Hands-on workshop building multimodal apps with Gemini 2.5 Flash, Vertex AI, and Cloud Run deployments.',
      type: 'Team', fee: 150, memberFee: 50, limit: 120, venue: 'Main Tech Auditorium',
      date: todayHour(3), endDate: todayHour(8), // TODAY
      banner: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_gdg_01',
      name: '100 Days of Google Cloud Bootcamp (Ongoing)',
      desc: 'Semester-long asynchronous learning journey with weekly checkpoints, mentorship, and Google Cloud skill badges.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 500, venue: 'Virtual Discord & Cloud LMS',
      date: daysOffset(-15), endDate: daysOffset(120), // ONGOING / NEVER-ENDING
      banner: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_gdg_01',
      name: 'Android Studio Jellyfish Hackathon',
      desc: 'Build high-performance native Android apps using Kotlin and Jetpack Compose. Cash prizes worth ₹30,000.',
      type: 'Team', fee: 200, memberFee: 100, limit: 80, venue: 'CSE Innovation Lab 3',
      date: daysOffset(7), endDate: daysOffset(8), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_gdg_01',
      name: 'Flutter Forward: Multiplatform Mastery',
      desc: 'Deep dive into state management, riverpod, and animations with senior Google Developer Experts.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 100, venue: 'Seminar Hall B',
      date: daysOffset(14), endDate: daysOffset(14, 18), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_gdg_01',
      name: 'Solutions Challenge Kickoff (Past)',
      desc: 'Orientation and problem statement release for the Global Google Student Solutions Challenge.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'Main Auditorium',
      date: daysOffset(-20), endDate: daysOffset(-20, 16), // PAST
      banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
    },

    // ── 2. Rotaract Club (5 events)
    {
      clubKey: 'club_rotaract_02',
      name: 'Skyline Blood Donation & Vitals Camp',
      desc: 'Annual campus blood donation drive in partnership with Red Cross Society. Certificates and refreshments provided.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 250, venue: 'Campus Health Center',
      date: todayHour(2), endDate: todayHour(7), // TODAY
      banner: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_rotaract_02',
      name: 'Project Green Campus: Tree Planting Challenge',
      desc: 'Ongoing semester tree adoption and green belt maintenance project across campus hostels and sports complexes.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 300, venue: 'Campus Gardens & Quadrangle',
      date: daysOffset(-10), endDate: daysOffset(180), // ONGOING
      banner: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_rotaract_02',
      name: 'Youth Leadership & Social Impact Summit',
      desc: 'Keynote panels on social entrepreneurship, community volunteering, and youth empowerment.',
      type: 'Solo', fee: 100, memberFee: 50, limit: 150, venue: 'Golden Jubilee Seminar Hall',
      date: daysOffset(5), endDate: daysOffset(5, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_rotaract_02',
      name: 'Book Drive for Rural Government Schools',
      desc: 'Help collect, sort, and box textbook donations for underserved schools in the surrounding district.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 120, venue: 'Student Activity Center',
      date: daysOffset(12), endDate: daysOffset(12, 16), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_rotaract_02',
      name: 'Blanket & Winter Clothes Drive (Past)',
      desc: 'Winter relief collection camp held in December for the local night shelters.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 180, venue: 'SAC Foyer',
      date: daysOffset(-25), endDate: daysOffset(-25, 18), // PAST
      banner: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&h=600&fit=crop',
    },

    // ── 3. IEEE Student Branch (5 events)
    {
      clubKey: 'club_ieee_03',
      name: 'PCB Design with KiCad: Fast-Track Lab',
      desc: 'Schematic capture, PCB layout routing, and Gerber generation for microcontroller breakouts.',
      type: 'Solo', fee: 120, memberFee: 40, limit: 60, venue: 'ECE Hardware Lab 102',
      date: todayHour(4), endDate: todayHour(8), // TODAY
      banner: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ieee_03',
      name: 'IEEE Research Paper Incubation (Ongoing)',
      desc: 'Quarter-long research methodology mentor program matching students with professors for IEEE conference submissions.',
      type: 'Team', fee: 0, memberFee: 0, limit: 50, venue: 'Research & Innovation Wing',
      date: daysOffset(-30), endDate: daysOffset(150), // ONGOING
      banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ieee_03',
      name: 'HackMatrix 24-Hour Hardware & IoT Hackathon',
      desc: 'Build smart city sensors, wearable trackers, and robotics embedded systems with live components provided.',
      type: 'Team', fee: 250, memberFee: 100, limit: 60, venue: 'Advanced Computing Center',
      date: daysOffset(9), endDate: daysOffset(10), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ieee_03',
      name: 'Quantum Computing Fundamentals with Qiskit',
      desc: 'Introduction to qubits, superposition, quantum circuits, and simulation on IBM Quantum Cloud.',
      type: 'Solo', fee: 80, memberFee: 20, limit: 90, venue: 'Seminar Hall 3',
      date: daysOffset(18), endDate: daysOffset(18, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ieee_03',
      name: 'Microcontroller Programming Masterclass (Past)',
      desc: 'Hands-on ESP32 and STM32 register-level programming with FreeRTOS.',
      type: 'Solo', fee: 100, memberFee: 30, limit: 70, venue: 'Lab 204',
      date: daysOffset(-14), endDate: daysOffset(-14, 17), // PAST
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=600&fit=crop',
    },

    // ── 4. ACM Student Chapter (5 events)
    {
      clubKey: 'club_acm_04',
      name: 'ICPC Style Speed Coding Clash',
      desc: '2.5 hour intense algorithm sprint on graphs, DP, and segment trees with live Elo ratings.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 100, venue: 'Central Computing Facility Lab 1',
      date: todayHour(5), endDate: todayHour(8), // TODAY
      banner: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_acm_04',
      name: 'ACM CodeSprint Competitive League (Ongoing)',
      desc: 'Weekly algorithm tournament every Wednesday. Leaderboards tracked throughout the academic year.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 300, venue: 'Online CodeForces & VJudge',
      date: daysOffset(-45), endDate: daysOffset(200), // ONGOING
      banner: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_acm_04',
      name: 'Graph Neural Networks & Modern Algorithms',
      desc: 'Exploration of PageRank, spectral clustering, and geometric deep learning architectures.',
      type: 'Solo', fee: 100, memberFee: 30, limit: 80, venue: 'Seminar Hall 1',
      date: daysOffset(6), endDate: daysOffset(6, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_acm_04',
      name: 'Technical Interview Demystified: System Design',
      desc: 'Architecting distributed URL shorteners, cache layers, and consensus algorithms for FAANG interviews.',
      type: 'Solo', fee: 75, memberFee: 0, limit: 120, venue: 'Auditorium 2',
      date: daysOffset(15), endDate: daysOffset(15, 18), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_acm_04',
      name: 'Winter Code Sprint 2025 (Past)',
      desc: 'Year-end algorithm battle with 180 participating student programmers.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 180, venue: 'Lab 1',
      date: daysOffset(-35), endDate: daysOffset(-35, 18), // PAST
      banner: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=600&fit=crop',
    },

    // ── 5. Design & Creative Arts Guild (5 events)
    {
      clubKey: 'club_design_05',
      name: 'Figma Auto-Layout & Design System Sprint',
      desc: 'Build enterprise design tokens, variable modes, and accessible component libraries in 3 hours.',
      type: 'Solo', fee: 80, memberFee: 0, limit: 75, venue: 'Design Studio Lab 4',
      date: todayHour(2), endDate: todayHour(6), // TODAY
      banner: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_design_05',
      name: 'Campus Visual Identity Showcase (Ongoing)',
      desc: 'Crowdsourced student portfolio gallery and redesign challenge for all college fest identities.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 150, venue: 'Art Gallery Corridor & Web',
      date: daysOffset(-15), endDate: daysOffset(100), // ONGOING
      banner: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_design_05',
      name: 'Blender 3D Modeling for Product Concepts',
      desc: 'Master hard-surface modeling, geometry nodes, and realistic Cycles material lighting.',
      type: 'Solo', fee: 120, memberFee: 40, limit: 60, venue: 'Multimedia Lab',
      date: daysOffset(4), endDate: daysOffset(4, 18), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_design_05',
      name: 'Typography & Editorial Poster Battle',
      desc: 'Swiss style layout principles, grid systems, and expressive kinetic typography workshop.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 70, venue: 'Design Studio',
      date: daysOffset(11), endDate: daysOffset(11, 16), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_design_05',
      name: 'UX Research & User Testing Workshop (Past)',
      desc: 'Synthesizing user interviews, heuristic analysis, and usability test recordings.',
      type: 'Solo', fee: 60, memberFee: 20, limit: 65, venue: 'Hall 2',
      date: daysOffset(-18), endDate: daysOffset(-18, 16), // PAST
      banner: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=1200&h=600&fit=crop',
    },

    // ── 6. Skyline Open Source & Linux Club (5 events)
    {
      clubKey: 'club_opensource_06',
      name: 'Git Rebase, Bisect & Cherry-Pick Mastery',
      desc: 'Unravel complex merge conflicts, understand the Git internal object store, and master interactive rebasing.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 90, venue: 'Linux Lab 2',
      date: todayHour(3), endDate: todayHour(6), // TODAY
      banner: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_opensource_06',
      name: 'Open Source Winter of Code Mentorship (Ongoing)',
      desc: '12-week guided contribution program pairing students with maintainers of popular GitHub repositories.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'GitHub Discussions & Matrix Chat',
      date: daysOffset(-20), endDate: daysOffset(90), // ONGOING
      banner: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_opensource_06',
      name: 'Linux Kernel Modules & Syscall Interception',
      desc: 'Write custom loadable kernel modules (LKMs) in C on modern 6.x Linux kernels.',
      type: 'Solo', fee: 80, memberFee: 0, limit: 50, venue: 'Systems Lab',
      date: daysOffset(8), endDate: daysOffset(8, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_opensource_06',
      name: 'Self-Hosting & Homelab Infrastructure Day',
      desc: 'Setting up Proxmox, Docker containers, WireGuard VPNs, and Nextcloud on refurbished PCs.',
      type: 'Team', fee: 100, memberFee: 30, limit: 60, venue: 'Networking Lab',
      date: daysOffset(16), endDate: daysOffset(16, 18), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_opensource_06',
      name: 'Docker & Kubernetes Containerization Camp (Past)',
      desc: 'Containerizing multi-service microservices and deploying with Helm charts.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 110, venue: 'Hall C',
      date: daysOffset(-28), endDate: daysOffset(-28, 17), // PAST
      banner: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=1200&h=600&fit=crop',
    },

    // ── 7. E-Cell (5 events)
    {
      clubKey: 'club_ecell_07',
      name: 'Pitch Deck Clinic & Term Sheet Teardown',
      desc: 'Reviewing real angel term sheets, valuation formulas, and feedback on student founder slides.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 80, venue: 'Startup Incubation Boardroom',
      date: todayHour(4), endDate: todayHour(7), // TODAY
      banner: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ecell_07',
      name: 'Skyline Venture Accelerator Cohort (Ongoing)',
      desc: '6-month university startup accelerator providing ₹1,00,000 equity-free prototype grants and angel mentorship.',
      type: 'Team', fee: 0, memberFee: 0, limit: 25, venue: 'Incubation Center Wing A',
      date: daysOffset(-15), endDate: daysOffset(165), // ONGOING
      banner: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ecell_07',
      name: 'Disrupt 2026: Annual Business Plan Competition',
      desc: 'Showcase your tech or consumer brand to venture capitalists from Sequoia and Accel. Grand prize ₹1,50,000.',
      type: 'Team', fee: 200, memberFee: 80, limit: 50, venue: 'Auditorium 1',
      date: daysOffset(10), endDate: daysOffset(11), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ecell_07',
      name: 'Product-Market Fit & Customer Discovery Live',
      desc: 'Frameworks to interview 50 potential customers before writing a single line of production code.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 120, venue: 'Seminar Hall 2',
      date: daysOffset(17), endDate: daysOffset(17, 16), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_ecell_07',
      name: 'Angel Investor Fireside Chat (Past)',
      desc: 'Q&A session with 3 alumni founders who raised Series A funding.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 140, venue: 'Main Hall',
      date: daysOffset(-12), endDate: daysOffset(-12, 18), // PAST
      banner: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&h=600&fit=crop',
    },

    // ── 8. Robotics & Automation Society (5 events)
    {
      clubKey: 'club_robotics_08',
      name: 'Combat Bot Arena Testing & Weapon Balance',
      desc: 'Weight-in, safety check, and armor balance testing for 15kg featherweight combat robots.',
      type: 'Team', fee: 100, memberFee: 30, limit: 40, venue: 'Robotics Workshop Arena',
      date: todayHour(2), endDate: todayHour(7), // TODAY
      banner: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_robotics_08',
      name: 'Autonomous Rover Challenge Build (Ongoing)',
      desc: 'Semester project developing GPS + LiDAR waypoint rovers for the University Rover Challenge.',
      type: 'Team', fee: 0, memberFee: 0, limit: 30, venue: 'Advanced Mechatronics Lab',
      date: daysOffset(-25), endDate: daysOffset(140), // ONGOING
      banner: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_robotics_08',
      name: 'Drone Dynamics & FPV Racing Pilot School',
      desc: 'Assembly of quadcopter frames, BLDC motor tuning, ESC calibration, and simulator flying.',
      type: 'Solo', fee: 250, memberFee: 100, limit: 45, venue: 'Campus Open Football Ground',
      date: daysOffset(6), endDate: daysOffset(6, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_robotics_08',
      name: 'ROS2 (Robot Operating System) in C++ & Python',
      desc: 'Publishers, subscribers, action servers, and Gazebo 3D simulation of differential drive robots.',
      type: 'Solo', fee: 150, memberFee: 50, limit: 55, venue: 'Robotics Software Lab',
      date: daysOffset(13), endDate: daysOffset(13, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_robotics_08',
      name: 'Line Follower & Maze Solver Championship (Past)',
      desc: 'Annual junior robotics competition testing PID algorithms on white-line tracks.',
      type: 'Team', fee: 100, memberFee: 30, limit: 80, venue: 'Indoor Sports Complex',
      date: daysOffset(-22), endDate: daysOffset(-22, 18), // PAST
      banner: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1200&h=600&fit=crop',
    },

    // ── 9. Music & Performing Arts Society (5 events)
    {
      clubKey: 'club_music_09',
      name: 'Acoustic Unplugged Evening: Open Mic',
      desc: 'Unplugged guitar, keyboard, cajon and vocal sets under the stars at the campus amphitheatre.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'Open Amphitheatre',
      date: todayHour(5), endDate: todayHour(9), // TODAY
      banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_music_09',
      name: 'Campus Symphony & Choir Residency (Ongoing)',
      desc: 'Semester choir rehearsals and western classical harmony training open to all student instrumentalists.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 80, venue: 'Performing Arts Hall',
      date: daysOffset(-15), endDate: daysOffset(105), // ONGOING
      banner: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_music_09',
      name: 'Battle of the Bands: Sound Clash 2026',
      desc: '12 college rock and fusion bands compete with original compositions for ₹40,000 in cash prizes.',
      type: 'Team', fee: 300, memberFee: 150, limit: 20, venue: 'Main College Ground Stage',
      date: daysOffset(11), endDate: daysOffset(11, 22), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_music_09',
      name: 'Digital Audio Production in Ableton Live',
      desc: 'MIDI sequencing, synthesizer design, EQing, and mixing commercial EDM and pop tracks.',
      type: 'Solo', fee: 100, memberFee: 30, limit: 60, venue: 'Music Studio Lab',
      date: daysOffset(19), endDate: daysOffset(19, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_music_09',
      name: 'Retro Vinyl & Jazz Night (Past)',
      desc: 'An evening celebrating classic 70s rock and jazz improvisation.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 120, venue: 'Amphitheatre',
      date: daysOffset(-16), endDate: daysOffset(-16, 21), // PAST
      banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
    },

    // ── 10. Literary & Debating Society (5 events)
    {
      clubKey: 'club_litsoc_10',
      name: 'Parliamentary Debate Spar & Motion Drop',
      desc: 'Asian Parliamentary format debate showdown with topics announced 15 minutes before the round.',
      type: 'Team', fee: 0, memberFee: 0, limit: 60, venue: 'Seminar Hall 4',
      date: todayHour(3), endDate: todayHour(7), // TODAY
      banner: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_litsoc_10',
      name: 'Campus Literary Magazine Editorial Sprint (Ongoing)',
      desc: 'Bi-annual print magazine curation accepting student essays, poetry, and investigative journalism pieces.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 100, venue: 'Library Conference Room & Online',
      date: daysOffset(-20), endDate: daysOffset(110), // ONGOING
      banner: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_litsoc_10',
      name: 'Skyline Model United Nations (MUN 2026)',
      desc: 'Two days of diplomatic debate across UNSC, DISEC, and Historic Crisis committees.',
      type: 'Solo', fee: 350, memberFee: 150, limit: 180, venue: 'Central Academic Block',
      date: daysOffset(14), endDate: daysOffset(15), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_litsoc_10',
      name: 'Creative Writing Masterclass: Worldbuilding in Sci-Fi',
      desc: 'Crafting believable fictional societies, speculative technologies, and tension-driven plots.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 80, venue: 'Seminar Hall 2',
      date: daysOffset(21), endDate: daysOffset(21, 17), // UPCOMING
      banner: 'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=1200&h=600&fit=crop',
    },
    {
      clubKey: 'club_litsoc_10',
      name: 'National Quiz Championship Qualifiers (Past)',
      desc: 'General knowledge, pop culture, and science quiz tournament with 50 student teams.',
      type: 'Team', fee: 50, memberFee: 0, limit: 100, venue: 'Main Auditorium',
      date: daysOffset(-30), endDate: daysOffset(-30, 18), // PAST
      banner: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=1200&h=600&fit=crop',
    },
  ];

  for (const bp of eventBlueprints) {
    const parentClub = clubs[bp.clubKey];
    const ev = await prisma.event.create({
      data: {
        clubId: parentClub.id,
        name: bp.name,
        description: bp.desc,
        eventType: bp.type,
        fee: bp.fee,
        memberFee: bp.memberFee,
        registrationLimit: bp.limit,
        registrationDeadline: new Date(bp.date.getTime() - 2 * 60 * 60 * 1000),
        eventDate: bp.date,
        eventEndDate: bp.endDate,
        venue: bp.venue,
        teamSizeLimit: bp.type === 'Team' ? 4 : null,
        minTeamSize: bp.type === 'Team' ? 2 : null,
        upiId: parentClub.upiId,
        bannerUrl: bp.banner,
        qrUrl: parentClub.qrUrl,
        isPublished: true,
      },
    });
    createdEvents.push(ev);
  }

  // ── 6. Create 50 Merch Products (5 items per club x 10 clubs) ───────────────
  console.log('🛍️ Creating 50 merchandise products across 10 clubs...');

  const merchCatalog = [
    // GDG (5 items)
    { clubKey: 'club_gdg_01', name: 'GDG Heavyweight Campus Hoodie', desc: 'Heavyweight fleece navy blue hoodie with the official GDG on Campus crest.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop' },
    { clubKey: 'club_gdg_01', name: 'GDG Developer Oversized T-Shirt', desc: '100% bio-washed cotton minimalist tech tee with Google Cloud emblem.', price: 29900, discount: 15, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=600&fit=crop' },
    { clubKey: 'club_gdg_01', name: 'GDG Waterproof Laptop Sleeve (14-16")', desc: 'Padded neoprene sleeve with dual compartments and anti-scratch lining.', price: 39900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { clubKey: 'club_gdg_01', name: 'GDG Matte Black Stainless Water Bottle', desc: '750ml double-wall vacuum insulated flask keeping drinks cold for 24h.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop' },
    { clubKey: 'club_gdg_01', name: 'GDG Holographic Sticker Pack (Set of 10)', desc: 'Matte vinyl waterproof stickers for laptop, keyboard, and phone cases.', price: 9900, discount: 10, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // Rotaract (5 items)
    { clubKey: 'club_rotaract_02', name: 'Rotaract Classic Embroidered Polo', desc: 'Breathable pique cotton collared polo in crisp royal blue.', price: 39900, discount: 15, image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop' },
    { clubKey: 'club_rotaract_02', name: 'Rotaract Heavy Duty Canvas Tote Bag', desc: 'Eco-friendly organic canvas tote bag with reinforced handles.', price: 19900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { clubKey: 'club_rotaract_02', name: 'Rotaract Ceramic Coffee Mug', desc: '350ml glossy ceramic mug with inspirational leadership quote.', price: 14900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { clubKey: 'club_rotaract_02', name: 'Rotaract Hardcover Bullet Journal', desc: '192-page dotted grid notebook with ribbon bookmark and pen holder.', price: 24900, discount: 10, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { clubKey: 'club_rotaract_02', name: 'Rotaract Silicone Wristband Set (Pack of 3)', desc: 'Durable debossed silicone wristbands in vibrant community colors.', price: 7900, discount: 0, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop' },

    // IEEE (5 items)
    { clubKey: 'club_ieee_03', name: 'IEEE Circuit Track Bomber Jacket', desc: 'Windproof lightweight nylon jacket featuring subtle copper circuit board prints.', price: 69900, discount: 20, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop' },
    { clubKey: 'club_ieee_03', name: 'IEEE Technical Cotton T-Shirt', desc: 'Pre-shrunk cotton tee with IEEE student branch technical seal.', price: 28900, discount: 15, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop' },
    { clubKey: 'club_ieee_03', name: 'IEEE Precision Mousepad (XL Desk Mat)', desc: '900x400mm micro-weave cloth mat with anti-fray stitched edges.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&h=600&fit=crop' },
    { clubKey: 'club_ieee_03', name: 'IEEE Brass Metal Pin & Lanyard Set', desc: 'High-polish metal lapel pin and woven badge lanyard for conferences.', price: 12900, discount: 10, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { clubKey: 'club_ieee_03', name: 'IEEE Aluminum Multi-Angle Phone Stand', desc: 'Collapsible desktop aluminum phone and tablet dock.', price: 22900, discount: 10, image: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&h=600&fit=crop' },

    // ACM (5 items)
    { clubKey: 'club_acm_04', name: 'ACM Terminal Dark Mode Hoodie', desc: 'Black zip hoodie featuring monospace ASCII syntax tree on the back.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&h=600&fit=crop' },
    { clubKey: 'club_acm_04', name: 'ACM Algorithms & Big-O T-Shirt', desc: 'Complexity chart graphic tee on charcoal grey heavyweight cotton.', price: 29900, discount: 15, image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=600&fit=crop' },
    { clubKey: 'club_acm_04', name: 'ACM Artisan Mechanical Keycap (Cherry MX)', desc: 'Custom resin artisan keycap featuring the ACM crest for ESC key.', price: 19900, discount: 10, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=600&fit=crop' },
    { clubKey: 'club_acm_04', name: 'ACM Insulated Coffee Tumbler', desc: 'Spill-proof 450ml matte tumbler built for late-night contest coding.', price: 29900, discount: 10, image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&h=600&fit=crop' },
    { clubKey: 'club_acm_04', name: 'ACM Monospace Laptop Decals Pack', desc: 'Die-cut vinyl stickers covering dynamic programming, graph theory & regex.', price: 8900, discount: 0, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // Design (5 items)
    { clubKey: 'club_design_05', name: 'DCAG Minimalist French Terry Sweatshirt', desc: 'Clean architectural line embroidery on premium French terry fabric.', price: 49900, discount: 15, image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop' },
    { clubKey: 'club_design_05', name: 'DCAG Golden Ratio Oversized Tee', desc: 'Fibonacci spiral diagram printed in subtle silver on ivory cotton.', price: 31900, discount: 10, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=600&fit=crop' },
    { clubKey: 'club_design_05', name: 'DCAG Hardbound Sketchbook (180 GSM)', desc: 'Heavyweight bleed-proof paper designed for markers, ink, and pencil sketches.', price: 27900, discount: 15, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { clubKey: 'club_design_05', name: 'DCAG Enamel Pin Collector Bundle', desc: 'Set of 4 soft enamel pins: Bezier Pen tool, CMYK swatch, Eye-dropper, and Font glyph.', price: 15900, discount: 10, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { clubKey: 'club_design_05', name: 'DCAG Structured Canvas Duffle Bag', desc: 'Compact gym and weekend travel duffle with dedicated shoe pocket.', price: 44900, discount: 15, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop' },

    // Open Source (5 items)
    { clubKey: 'club_opensource_06', name: 'Skyline Linux Tux Emblem Hoodie', desc: 'Cozy charcoal hoodie with Tux penguin and open source badge.', price: 52900, discount: 20, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop' },
    { clubKey: 'club_opensource_06', name: 'Git Commit -m "Initial Release" T-Shirt', desc: 'Vintage wash tech tee for open-source software maintainers.', price: 27900, discount: 10, image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=600&fit=crop' },
    { clubKey: 'club_opensource_06', name: 'Vim Keybindings Cheat Sheet Desk Mat', desc: 'Extended 800x300mm stitched desk mat with Vim command cheat sheet.', price: 32900, discount: 15, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&h=600&fit=crop' },
    { clubKey: 'club_opensource_06', name: 'Stainless Steel Carabiner Camping Mug', desc: '300ml lightweight double-wall mug with carabiner handle for outdoor hackathons.', price: 18900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { clubKey: 'club_opensource_06', name: 'Open Source OSS Distro Sticker Pack', desc: 'Pack of 12 stickers: Arch, Debian, Fedora, Ubuntu, Alpine, Rust, and Go.', price: 9900, discount: 0, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // E-Cell (5 items)
    { clubKey: 'club_ecell_07', name: 'E-Cell Founder Quarter-Zip Pullover', desc: 'Athletic fit navy pullover tailored for demo days and venture meetings.', price: 59900, discount: 20, image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop' },
    { clubKey: 'club_ecell_07', name: 'E-Cell Hustle & Scale Pique Polo', desc: 'Breathable corporate polo with subtle E-Cell crest embroidery.', price: 36900, discount: 15, image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop' },
    { clubKey: 'club_ecell_07', name: 'E-Cell Executive Leatherette Portfolio', desc: 'Document holder with notepad slot, business card sleeves and magnetic clasp.', price: 39900, discount: 10, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { clubKey: 'club_ecell_07', name: 'E-Cell Matte Metal Rollerball Pen (Weighted)', desc: 'Balanced aluminum writing pen with refillable German Schmidt ink cartridge.', price: 14900, discount: 10, image: 'https://images.unsplash.com/photo-1585336261026-c24151a7e43b?w=600&h=600&fit=crop' },
    { clubKey: 'club_ecell_07', name: 'E-Cell Vacuum Coffee Flask (500ml)', desc: 'Temperature-display smart lid vacuum flask for busy founders on the move.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop' },

    // Robotics (5 items)
    { clubKey: 'club_robotics_08', name: 'Robotics Society Team Windbreaker', desc: 'Weather-resistant lightweight hooded jacket with reflective arm accents.', price: 62900, discount: 20, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop' },
    { clubKey: 'club_robotics_08', name: 'Robotics Hardware Crewneck Sweatshirt', desc: 'Heavyweight cotton crewneck featuring mechatronics exploded diagram.', price: 47900, discount: 15, image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop' },
    { clubKey: 'club_robotics_08', name: 'Robotics Tactical Embroidered Dad Cap', desc: 'Adjustable 6-panel unstructured cap with brass buckle.', price: 21900, discount: 10, image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop' },
    { clubKey: 'club_robotics_08', name: 'Robotics 6-in-1 Precision Multi-Tool Pen', desc: 'Aluminum pen with built-in spirit level, rulers, and screwdriver bits.', price: 16900, discount: 10, image: 'https://images.unsplash.com/photo-1585336261026-c24151a7e43b?w=600&h=600&fit=crop' },
    { clubKey: 'club_robotics_08', name: 'Heavy Duty Workshop Tool Organizer Pouch', desc: 'Waterproof cordura pouch for wire strippers, cutters, and soldering gear.', price: 25900, discount: 10, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop' },

    // Music (5 items)
    { clubKey: 'club_music_09', name: 'Acoustix Tour Band Graphic Hoodie', desc: 'Heavyweight black hoodie with distressed musical waveform print.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&h=600&fit=crop' },
    { clubKey: 'club_music_09', name: 'Acoustix Live Sessions Vintage T-Shirt', desc: 'Soft-touch acid wash tee with retro cassette tape graphic.', price: 29900, discount: 10, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop' },
    { clubKey: 'club_music_09', name: 'Acoustix Guitar Pick Tin (Pack of 12 Picks)', desc: 'Matte celluloid picks across thin, medium & heavy gauges in sliding tin.', price: 9900, discount: 0, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { clubKey: 'club_music_09', name: 'Vinyl Record Silicone Coasters (Set of 4)', desc: 'Non-slip vintage vinyl record drink coasters with album label art.', price: 13900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { clubKey: 'club_music_09', name: 'Acoustix Canvas Music Tote & Gig Bag Strap', desc: 'Wide shoulder strap tote with internal zippered pouch for capos & cables.', price: 21900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },

    // LitSoc (5 items)
    { clubKey: 'club_litsoc_10', name: 'LitSoc "Between The Lines" Vintage Hoodie', desc: 'Forest green heavyweight hoodie with classic literary typography.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop' },
    { clubKey: 'club_litsoc_10', name: 'LitSoc Literary Quotes Natural Canvas Tote', desc: 'Sturdy 12oz natural cotton tote with timeless quotes on discourse and ideas.', price: 18900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { clubKey: 'club_litsoc_10', name: 'LitSoc Genuine Leather Bookmark (Set of 2)', desc: 'Hand-burnished vegetable tanned leather bookmarks with brass eyelets.', price: 11900, discount: 10, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { clubKey: 'club_litsoc_10', name: 'LitSoc Oxford Debate Ceramic Mug', desc: '380ml heavyweight ceramic mug for coffee-fueled parliamentary research.', price: 14900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { clubKey: 'club_litsoc_10', name: 'LitSoc Premium Fountain Pen Friendly Notebook', desc: '160-page ivory 120 GSM paper bound in soft vegan leather.', price: 26900, discount: 15, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
  ];

  const createdProducts: any[] = [];
  for (const m of merchCatalog) {
    const parentClub = clubs[m.clubKey];
    const p = await prisma.product.create({
      data: {
        clubId: parentClub.id,
        name: m.name,
        description: m.desc,
        imageUrl: m.image,
        pricePaise: m.price,
        memberDiscountPercent: m.discount,
        isPublished: true,
        variants: {
          create: [
            { label: 'S', stock: 15 },
            { label: 'M', stock: 25 },
            { label: 'L', stock: 20 },
            { label: 'XL', stock: 10 },
          ],
        },
      },
    });
    createdProducts.push(p);
  }

  // ── 7. Seed Registrations for Demo Student Alex Rivera ───────────────────────
  console.log('🎟️ Seeding real registrations for student@college.edu...');

  // 7.1 Register for Today's GDG DevFest (CONFIRMED Ticket)
  const devFestEvent = createdEvents[0];
  const devFestTeam = await prisma.team.create({
    data: {
      eventId: devFestEvent.id,
      teamName: 'Team ByteCraft',
      passkey: 'BYTE2026',
      leaderId: demoStudent.id,
    },
  });

  const reg1 = await prisma.registration.create({
    data: {
      eventId: devFestEvent.id,
      userId: demoStudent.id,
      teamId: devFestTeam.id,
      status: RegistrationStatus.CONFIRMED,
      feeCharged: devFestEvent.memberFee ?? devFestEvent.fee,
      isMemberPrice: true,
      transactionId: 'UPI-TXN-ALEX-DEVFEST-99',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      checkedInAt: new Date(),
    },
  });

  // 7.2 Register for Ongoing Bootcamp (CONFIRMED)
  const bootcampEvent = createdEvents[1];
  await prisma.registration.create({
    data: {
      eventId: bootcampEvent.id,
      userId: demoStudent.id,
      status: RegistrationStatus.CONFIRMED,
      feeCharged: 0,
      isMemberPrice: false,
      transactionId: 'FREE-REG-BOOTCAMP-ALEX',
    },
  });

  // 7.3 Register for Upcoming HackMatrix (PENDING Verification)
  const hackmatrixEvent = createdEvents[12]; // IEEE HackMatrix
  await prisma.registration.create({
    data: {
      eventId: hackmatrixEvent.id,
      userId: demoStudent.id,
      status: RegistrationStatus.PENDING,
      feeCharged: hackmatrixEvent.fee,
      isMemberPrice: false,
      transactionId: 'UPI-TXN-HACKMATRIX-SUBMITTED',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
    },
  });

  // 7.4 Register for Past Winter Hackathon (CONFIRMED / Past Ticket)
  const pastEvent = createdEvents[4]; // GDG Solutions Challenge
  await prisma.registration.create({
    data: {
      eventId: pastEvent.id,
      userId: demoStudent.id,
      status: RegistrationStatus.CONFIRMED,
      feeCharged: 0,
      isMemberPrice: false,
      transactionId: 'FREE-REG-SOLUTIONS-PAST',
      checkedInAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
  });

  // 7.5 Bookmark/Save some events for the student
  await prisma.savedEvent.createMany({
    data: [
      { userId: demoStudent.id, eventId: createdEvents[2].id },
      { userId: demoStudent.id, eventId: createdEvents[5].id },
      { userId: demoStudent.id, eventId: createdEvents[10].id },
    ],
    skipDuplicates: true,
  });

  // 7.6 Sample Merch Order for the student
  await prisma.order.create({
    data: {
      userId: demoStudent.id,
      clubId: clubs['club_gdg_01'].id,
      productId: createdProducts[0].id,
      buyerName: demoStudent.fullName,
      buyerEmail: demoStudent.email,
      productName: createdProducts[0].name,
      variantLabel: 'L',
      unitPricePaise: Math.round(createdProducts[0].pricePaise * 0.8),
      quantity: 1,
      totalPaise: Math.round(createdProducts[0].pricePaise * 0.8),
      isMemberPrice: true,
      status: 'PAID',
      transactionId: 'TXN-MERCH-ORDER-ALEX-HOODIE',
      paidAt: new Date(),
    },
  });

  // ── 8. Seed Real Cryptographic Ledger Entries ───────────────────────────────
  console.log('💎 Seeding audited ledger entries into SHA-256 hash chain...');

  // 8.1 Membership Dues (IN)
  await postLedger({
    clubId: clubs['club_gdg_01'].id,
    type: 'IN',
    category: 'DUES',
    amountPaise: 49900,
    refType: 'MEMBERSHIP_DUES',
    refId: `dues_${demoStudent.id}`,
    actorId: demoStudent.id,
    memo: 'Annual GDG Campus Membership Dues - Alex Rivera',
  });

  // 8.2 Ticket Sale for DevFest (IN)
  await postLedger({
    clubId: clubs['club_gdg_01'].id,
    type: 'IN',
    category: 'TICKET',
    amountPaise: 5000,
    refType: 'TICKET_SALE',
    refId: `ticket_${devFestEvent.id}_${demoStudent.id}`,
    eventId: devFestEvent.id,
    actorId: demoStudent.id,
    memo: 'DevFest 2026 Ticket - Alex Rivera (Member Discounted)',
  });

  // 8.3 Merch Sale (IN)
  await postLedger({
    clubId: clubs['club_gdg_01'].id,
    type: 'IN',
    category: 'MERCH',
    amountPaise: 43920,
    refType: 'MERCH_SALE',
    refId: 'merch_ord_alex_01',
    actorId: demoStudent.id,
    memo: 'GDG Heavyweight Campus Hoodie (Navy Blue, L)',
  });

  // 8.4 Sponsorship Grant (IN)
  await postLedger({
    clubId: clubs['club_gdg_01'].id,
    type: 'IN',
    category: 'FUNDRAISER',
    amountPaise: 150000,
    refType: 'FUNDRAISER_DONATION',
    refId: 'fund_devtech_grant_01',
    actorId: clubHeadProfiles['club_gdg_01'].id,
    memo: 'Google Developer Community Ecosystem Seed Grant',
  });

  // 8.5 Reimbursed Stage Banners Expense (OUT)
  const sampleClaim = await prisma.expenseClaim.create({
    data: {
      id: 'claim_seed_reimbursed_gdg',
      clubId: clubs['club_gdg_01'].id,
      claimantId: clubHeadProfiles['club_gdg_01'].id,
      title: 'DevFest Stage Banners & Standees',
      vendor: 'Campus Print Graphics',
      amountPaise: 12500,
      scannedAmount: 12500,
      category: 'EXPENSE',
      eventId: devFestEvent.id,
      receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      status: ExpenseStatus.REIMBURSED,
      reimbursedAt: new Date(),
    },
  });

  await postLedger({
    clubId: clubs['club_gdg_01'].id,
    type: 'OUT',
    category: 'EXPENSE',
    amountPaise: sampleClaim.amountPaise,
    refType: 'EXPENSE_REIMBURSEMENT',
    refId: sampleClaim.id,
    eventId: devFestEvent.id,
    actorId: clubHeadProfiles['club_gdg_01'].id,
    memo: `Reimbursement for Claim #${sampleClaim.id}: ${sampleClaim.title}`,
  });

  // ── 9. Create Notifications for Demo Student ────────────────────────────────
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: demoStudent.id,
        eventId: devFestEvent.id,
        type: 'REGISTRATION_CONFIRMED',
        title: 'Registration Confirmed: Google Cloud & Vertex AI DevFest',
        body: 'Your ticket for Google Cloud & Vertex AI DevFest with team ByteCraft is confirmed! Show your QR code at the door.',
        isRead: false,
      },
      {
        userId: demoStudent.id,
        type: 'MEMBERSHIP_ACTIVE',
        title: 'Welcome to GDG on Campus!',
        body: 'Your annual membership is active. You now receive automatic discounts on all GDG events and official merch.',
        isRead: true,
      },
    ],
  });

  // ── 10. Verify Cryptographic Integrity ──────────────────────────────────────
  console.log('🔒 Verifying cryptographic ledger chain integrity...');
  const chainAudit = await verifyChain();
  if (!chainAudit.valid) {
    throw new Error(`Ledger integrity check failed! Reason: ${chainAudit.reason}`);
  }

  console.log(`✅ Ledger Chain Intact: ${chainAudit.entryCount} entries verified with Head: ${chainAudit.headHash.slice(0, 16)}...`);
  console.log('\n=============================================================');
  console.log('🎉 SEEDING COMPLETE! DATASET OVERVIEW:');
  console.log(`   🏛️ Clubs: 10 clubs created`);
  console.log(`   📅 Events: 50 events created (Today, Ongoing, Upcoming & Past)`);
  console.log(`   🛍️ Merch: 50 products created with active variants`);
  console.log(`   👤 Demo Accounts:`);
  console.log(`      • Student: student@college.edu / Password@123 (Alex Rivera)`);
  console.log(`      • Admin:   admin@skyline.local / Password@123`);
  console.log(`      • Club Heads: gdg@college.edu, rotaract@college.edu, ... / Password@123`);
  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
