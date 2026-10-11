import { RegistrationStatus, Role, ExpenseStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../config/db';
import { postLedger, verifyChain, GENESIS_HASH } from '../modules/finance/ledger.service';

dotenv.config();

async function main() {
  console.log(`\n🌱 Seeding database additively (non-destructive: preserving all existing data)...`);

  // ── 1. Ensure Cryptographic LedgerHead exists ────────────────────────────────
  console.log('⛓️ Checking cryptographic LedgerHead...');
  const existingHead = await prisma.ledgerHead.findUnique({ where: { id: 1 } });
  if (!existingHead) {
    await prisma.ledgerHead.create({
      data: { id: 1, lastHash: GENESIS_HASH },
    });
    console.log('   Initialized LedgerHead with Genesis Hash.');
  } else {
    console.log('   LedgerHead already initialized.');
  }

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // ── 2. Create / Upsert 10 Distinct Campus Clubs ──────────────────────────────
  console.log('🏛️ Upserting 10 campus clubs...');
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
      membershipFeePaise: 34900,
      membershipMonths: 12,
    },
    {
      id: 'club_ecell_06',
      name: 'E-Cell (Entrepreneurship & Startups)',
      email: 'ecell@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=300&h=300&fit=crop',
      upiId: 'ecell@okaxis',
      membershipFeePaise: 44900,
      membershipMonths: 12,
    },
    {
      id: 'club_robotics_07',
      name: 'Robotics & Automation Society (RAS)',
      email: 'robotics@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&h=300&fit=crop',
      upiId: 'robotics@okhdfcbank',
      membershipFeePaise: 59900,
      membershipMonths: 12,
    },
    {
      id: 'club_music_08',
      name: 'Skyline Music & Sound Syndicate',
      email: 'music@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
      upiId: 'music@okaxis',
      membershipFeePaise: 24900,
      membershipMonths: 12,
    },
    {
      id: 'club_sports_09',
      name: 'Skyline Athletics & Sports Board',
      email: 'sports@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&h=300&fit=crop',
      upiId: 'sports@oksbi',
      membershipFeePaise: 19900,
      membershipMonths: 12,
    },
    {
      id: 'club_litsoc_10',
      name: 'Literary & Debating Society (LitSoc)',
      email: 'litsoc@college.edu',
      logoUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=300&h=300&fit=crop',
      upiId: 'litsoc@okaxis',
      membershipFeePaise: 19900,
      membershipMonths: 12,
    },
  ];

  const clubs: Record<string, any> = {};
  for (const c of clubDefinitions) {
    clubs[c.id] = await prisma.club.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        email: c.email,
        logoUrl: c.logoUrl,
        upiId: c.upiId,
        membershipFeePaise: c.membershipFeePaise,
        membershipMonths: c.membershipMonths,
      },
      create: {
        id: c.id,
        name: c.name,
        email: c.email,
        password: hashedPassword,
        logoUrl: c.logoUrl,
        upiId: c.upiId,
        membershipFeePaise: c.membershipFeePaise,
        membershipMonths: c.membershipMonths,
      },
    });
  }

  // ── 3. Create / Upsert Demo User Profiles ────────────────────────────────────
  console.log('👤 Upserting role-based demo profiles...');

  // Super Admin
  const superAdmin = await prisma.profile.upsert({
    where: { id: 'usr_super_admin_01' },
    update: { role: Role.SUPER_ADMIN },
    create: {
      id: 'usr_super_admin_01',
      fullName: 'Skyline Super Admin',
      email: 'admin@skyline.local',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  // Demo Student (Primary account for grading / browsing)
  const demoStudent = await prisma.profile.upsert({
    where: { id: 'usr_student_demo_01' },
    update: {
      fullName: 'Alex Rivera',
      email: 'student@college.edu',
      role: Role.STUDENT,
    },
    create: {
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
  const studentPriya = await prisma.profile.upsert({
    where: { id: 'usr_student_02' },
    update: {},
    create: {
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

  const studentRohan = await prisma.profile.upsert({
    where: { id: 'usr_student_03' },
    update: {},
    create: {
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
    clubHeadProfiles[c.id] = await prisma.profile.upsert({
      where: { id: `usr_head_${c.id}` },
      update: { clubId: c.id, role: Role.CLUB_HEAD },
      create: {
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
  await prisma.membership.upsert({
    where: { id: 'mem_gdg_alex_01' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'mem_gdg_alex_01',
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

  // ── 4. Create / Upsert 50 Events Across 10 Clubs ─────────────────────────────
  console.log('📅 Generating 50 events accurately partitioned across LIVE, UPCOMING, and PAST...');

  const now = new Date();
  const todayHour = (hourOffset: number) => new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
  const daysOffset = (days: number, hourOfDay = 10) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hourOfDay, 0, 0, 0);
    return d;
  };

  /**
   * For each of the 10 clubs:
   * 1. LIVE EVENT: started 2h ago, ends in 5h -> date <= now && endDate >= now (LIVE TAB)
   * 2. STARTS LATER TODAY: starts in 5h today, deadline in 4.5h -> date > now, REGISTRATION OPEN (UPCOMING TAB)
   * 3. UPCOMING SOLO: starts in 6 days, deadline in 5 days -> date > now, REGISTRATION OPEN (UPCOMING TAB)
   * 4. UPCOMING TEAM HACKATHON: starts in 14 days, deadline in 13 days -> date > now, REGISTRATION OPEN (UPCOMING TAB)
   * 5. PAST EVENT: ended 20 days ago -> endDate < now (PAST TAB)
   */
  const eventBlueprints = [
    // ── 1. GDG on Campus
    {
      id: 'ev_gdg_live_01', clubKey: 'club_gdg_01',
      name: 'Google Cloud & Vertex AI DevFest (Happening Now)',
      desc: 'Live hands-on build sprint using Gemini 2.5 Flash, Vertex AI, and Cloud Run. Mentors on floor assisting live.',
      type: 'Team', fee: 150, memberFee: 50, limit: 150, venue: 'Main Tech Auditorium',
      date: todayHour(-2), endDate: todayHour(5), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_gdg_today_02', clubKey: 'club_gdg_01',
      name: 'Evening Android Studio Jellyfish Jam (Starts Today)',
      desc: 'Evening workshop on Kotlin Jetpack Compose and reactive UI state management. Open registration.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 120, venue: 'Seminar Hall B',
      date: todayHour(5), endDate: todayHour(9), deadline: todayHour(4.5),
      banner: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_gdg_upcoming_03', clubKey: 'club_gdg_01',
      name: 'Flutter Forward: Multiplatform Architecture',
      desc: 'Deep dive into riverpod state management, offline-first sync, and smooth animations.',
      type: 'Solo', fee: 80, memberFee: 0, limit: 100, venue: 'CSE Innovation Lab 3',
      date: daysOffset(6, 10), endDate: daysOffset(6, 17), deadline: daysOffset(5, 23),
      banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_gdg_hackathon_04', clubKey: 'club_gdg_01',
      name: 'Skyline Global Solutions Challenge Hackathon',
      desc: '36-hour sprint solving UN Sustainable Development Goals using Google Cloud & AI. Prizes worth ₹50,000.',
      type: 'Team', fee: 200, memberFee: 100, limit: 80, venue: 'Auditorium Complex',
      date: daysOffset(14, 9), endDate: daysOffset(15, 20), deadline: daysOffset(13, 23),
      banner: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_gdg_past_05', clubKey: 'club_gdg_01',
      name: 'Winter Cloud Onboarding & Tech Talk (Past)',
      desc: 'Orientation and problem statement release for Google Developer Student Clubs.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'Main Auditorium',
      date: daysOffset(-20, 10), endDate: daysOffset(-20, 16), deadline: daysOffset(-21, 23),
      banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
    },

    // ── 2. Rotaract Club
    {
      id: 'ev_rotaract_live_01', clubKey: 'club_rotaract_02',
      name: 'Skyline Blood Donation & Vitals Camp (Happening Now)',
      desc: 'Annual campus blood donation drive with Red Cross Society. Walk-ins and registrations live.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 250, venue: 'Campus Health Center',
      date: todayHour(-1.5), endDate: todayHour(4.5), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_rotaract_today_02', clubKey: 'club_rotaract_02',
      name: 'Evening Youth Leadership Keynote (Starts Today)',
      desc: 'Keynote lecture on community leadership and social entrepreneurship by visiting alumni.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 150, venue: 'Golden Jubilee Seminar Hall',
      date: todayHour(4.5), endDate: todayHour(8), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_rotaract_upcoming_03', clubKey: 'club_rotaract_02',
      name: 'Rural Government Schools Book Drive',
      desc: 'Help collect, categorize, and pack textbooks and science kits for underserved district schools.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 120, venue: 'Student Activity Center',
      date: daysOffset(7, 10), endDate: daysOffset(7, 16), deadline: daysOffset(6, 23),
      banner: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_rotaract_hackathon_04', clubKey: 'club_rotaract_02',
      name: 'Social Innovation & Clean Campus Sprint',
      desc: 'Team competition designing eco-friendly hostel recycling and solar initiatives.',
      type: 'Team', fee: 100, memberFee: 50, limit: 60, venue: 'Campus Gardens & Quadrangle',
      date: daysOffset(12, 9), endDate: daysOffset(13, 18), deadline: daysOffset(11, 23),
      banner: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_rotaract_past_05', clubKey: 'club_rotaract_02',
      name: 'Winter Warmth Clothes Collection (Past)',
      desc: 'Winter relief collection camp held for regional community shelters.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 180, venue: 'SAC Foyer',
      date: daysOffset(-25, 10), endDate: daysOffset(-25, 17), deadline: daysOffset(-26, 23),
      banner: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&h=600&fit=crop',
    },

    // ── 3. IEEE Student Branch
    {
      id: 'ev_ieee_live_01', clubKey: 'club_ieee_03',
      name: 'PCB Design with KiCad: Hands-On Lab (Happening Now)',
      desc: 'Live schematic capture, trace routing, and Gerber verification with hardware mentors.',
      type: 'Solo', fee: 120, memberFee: 40, limit: 60, venue: 'ECE Hardware Lab 102',
      date: todayHour(-2), endDate: todayHour(4), deadline: todayHour(3.5),
      banner: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ieee_today_02', clubKey: 'club_ieee_03',
      name: 'Intro to Quantum Circuits with Qiskit (Starts Today)',
      desc: 'Evening introduction to qubits, superposition gates, and running jobs on IBM Quantum.',
      type: 'Solo', fee: 60, memberFee: 0, limit: 100, venue: 'Seminar Hall 3',
      date: todayHour(5.5), endDate: todayHour(9), deadline: todayHour(5),
      banner: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ieee_upcoming_03', clubKey: 'club_ieee_03',
      name: 'Embedded Systems with ESP32 & FreeRTOS',
      desc: 'Multi-threading on dual-core microcontrollers, MQTT telemetry, and edge firmware.',
      type: 'Solo', fee: 100, memberFee: 30, limit: 80, venue: 'Embedded Lab 204',
      date: daysOffset(8, 10), endDate: daysOffset(8, 17), deadline: daysOffset(7, 23),
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ieee_hackathon_04', clubKey: 'club_ieee_03',
      name: 'HackMatrix 24-Hour IoT & Robotics Hackathon',
      desc: 'Build smart city sensors, wearable trackers, and robotics embedded systems. Live components provided.',
      type: 'Team', fee: 250, memberFee: 100, limit: 60, venue: 'Advanced Computing Wing',
      date: daysOffset(15, 9), endDate: daysOffset(16, 12), deadline: daysOffset(14, 23),
      banner: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ieee_past_05', clubKey: 'club_ieee_03',
      name: 'Annual IEEE Paper Publication Showcase (Past)',
      desc: 'Symposium featuring undergraduate IEEE conference papers and professor peer reviews.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 120, venue: 'Research Wing Auditorium',
      date: daysOffset(-22, 10), endDate: daysOffset(-22, 18), deadline: daysOffset(-23, 23),
      banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=600&fit=crop',
    },

    // ── 4. ACM Student Chapter
    {
      id: 'ev_acm_live_01', clubKey: 'club_acm_04',
      name: 'ICPC Style Speed Coding Clash (Happening Now)',
      desc: '2.5 hour fast-paced algorithm sprint on graphs, DP, and segment trees with real-time leaderboard.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 100, venue: 'Central Computing Lab 1',
      date: todayHour(-1), endDate: todayHour(4), deadline: todayHour(3),
      banner: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_acm_today_02', clubKey: 'club_acm_04',
      name: 'System Design: Distributed Cache & URL Shortener (Starts Today)',
      desc: 'Architecting high-throughput scalable services for technical engineering interviews.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 140, venue: 'Auditorium 2',
      date: todayHour(6), endDate: todayHour(9.5), deadline: todayHour(5.5),
      banner: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_acm_upcoming_03', clubKey: 'club_acm_04',
      name: 'Graph Neural Networks & Geometric Deep Learning',
      desc: 'PageRank mathematical intuition, graph convolution layers, and molecular analysis.',
      type: 'Solo', fee: 100, memberFee: 30, limit: 80, venue: 'Seminar Hall 1',
      date: daysOffset(9, 10), endDate: daysOffset(9, 17), deadline: daysOffset(8, 23),
      banner: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_acm_hackathon_04', clubKey: 'club_acm_04',
      name: 'CodeSprint 48-Hour Open Source Battle',
      desc: 'Contribute features and patch issues across high-impact GitHub projects under mentor guidance.',
      type: 'Team', fee: 120, memberFee: 50, limit: 70, venue: 'Software Engineering Lab',
      date: daysOffset(16, 9), endDate: daysOffset(18, 12), deadline: daysOffset(15, 23),
      banner: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_acm_past_05', clubKey: 'club_acm_04',
      name: 'Winter Code Sprint 2025 (Past)',
      desc: 'Semester-end algorithmic showdown with 180 participating student programmers.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 180, venue: 'Lab 1',
      date: daysOffset(-30, 10), endDate: daysOffset(-30, 18), deadline: daysOffset(-31, 23),
      banner: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=600&fit=crop',
    },

    // ── 5. Design & Creative Arts Guild
    {
      id: 'ev_design_live_01', clubKey: 'club_design_05',
      name: 'Figma Auto-Layout & Design Tokens Sprint (Happening Now)',
      desc: 'Live studio workshop building enterprise component libraries and token architectures.',
      type: 'Solo', fee: 80, memberFee: 0, limit: 75, venue: 'Design Studio Lab 4',
      date: todayHour(-2.5), endDate: todayHour(3.5), deadline: todayHour(3),
      banner: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_design_today_02', clubKey: 'club_design_05',
      name: 'Evening Typography & Visual Hierarchy Salon (Starts Today)',
      desc: 'Mastering font pairing, optical balance, and responsive layout grids.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 90, venue: 'Art Gallery Foyer',
      date: todayHour(5), endDate: todayHour(8.5), deadline: todayHour(4.5),
      banner: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_design_upcoming_03', clubKey: 'club_design_05',
      name: '3D Spline & Blender Micro-Interactions for Web',
      desc: 'Creating interactive 3D assets and embedding them smoothly into Next.js applications.',
      type: 'Solo', fee: 120, memberFee: 40, limit: 60, venue: 'Media Center Lab',
      date: daysOffset(5, 10), endDate: daysOffset(5, 16), deadline: daysOffset(4, 23),
      banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_design_hackathon_04', clubKey: 'club_design_05',
      name: '24-Hour Campus Brand Redesign Challenge',
      desc: 'Reimagine branding, stationery, mobile apps, and merchandise for college organizations.',
      type: 'Team', fee: 150, memberFee: 50, limit: 50, venue: 'Architecture Foyer',
      date: daysOffset(13, 9), endDate: daysOffset(14, 18), deadline: daysOffset(12, 23),
      banner: 'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_design_past_05', clubKey: 'club_design_05',
      name: 'Annual Student Design Exhibition 2025 (Past)',
      desc: 'Exhibition of student typography, product designs, and interactive digital interfaces.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 250, venue: 'Main Art Gallery',
      date: daysOffset(-28, 10), endDate: daysOffset(-28, 18), deadline: daysOffset(-29, 23),
      banner: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop',
    },

    // ── 6. E-Cell
    {
      id: 'ev_ecell_live_01', clubKey: 'club_ecell_06',
      name: 'Venture Pitch & Angel Round Deck Sprint (Happening Now)',
      desc: 'Live pitch deck reviews with angel investors and tech founders. Feedback provided in real time.',
      type: 'Solo', fee: 100, memberFee: 50, limit: 80, venue: 'Startup Incubation Center',
      date: todayHour(-1.5), endDate: todayHour(4.5), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ecell_today_02', clubKey: 'club_ecell_06',
      name: 'From Zero to Seed Round: Founder Fireside (Starts Today)',
      desc: 'Candid Q&A on finding co-founders, building early MVPs, and navigating initial customer acquisition.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 160, venue: 'Auditorium 1',
      date: todayHour(5), endDate: todayHour(8.5), deadline: todayHour(4.5),
      banner: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ecell_upcoming_03', clubKey: 'club_ecell_06',
      name: 'B2B SaaS Growth & Unit Economics Masterclass',
      desc: 'Calculating CAC, LTV, churn rate, and pricing tiers for campus software entrepreneurs.',
      type: 'Solo', fee: 150, memberFee: 50, limit: 70, venue: 'MBA Seminar Hall',
      date: daysOffset(7, 10), endDate: daysOffset(7, 17), deadline: daysOffset(6, 23),
      banner: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ecell_hackathon_04', clubKey: 'club_ecell_06',
      name: 'Skyline Shark Tank: Campus Startup Battle',
      desc: 'Pitch live to verified venture funds with ₹1,00,000 equity-free seed grant pool.',
      type: 'Team', fee: 300, memberFee: 150, limit: 40, venue: 'Convention Center',
      date: daysOffset(17, 9), endDate: daysOffset(17, 21), deadline: daysOffset(15, 23),
      banner: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_ecell_past_05', clubKey: 'club_ecell_06',
      name: 'E-Summit Winter Conference (Past)',
      desc: 'Annual summit hosting 12 industry leaders and 400 collegiate attendees.',
      type: 'Solo', fee: 100, memberFee: 50, limit: 300, venue: 'Convention Center',
      date: daysOffset(-24, 10), endDate: daysOffset(-24, 19), deadline: daysOffset(-25, 23),
      banner: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=600&fit=crop',
    },

    // ── 7. Robotics & Automation Society
    {
      id: 'ev_robotics_live_01', clubKey: 'club_robotics_07',
      name: 'Autonomous Rover Sensor Fusion & LIDAR Lab (Happening Now)',
      desc: 'Live SLAM mapping, IMU sensor fusion, and ROS 2 nodes running on tracked autonomous chassis.',
      type: 'Solo', fee: 150, memberFee: 50, limit: 50, venue: 'Robotics Workshop Bay 1',
      date: todayHour(-2), endDate: todayHour(4), deadline: todayHour(3.5),
      banner: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_robotics_today_02', clubKey: 'club_robotics_07',
      name: 'CAD for 3D Printing with Autodesk Fusion (Starts Today)',
      desc: 'Parametric modeling, gear trains, tolerances, and slicer optimizations for rapid prototyping.',
      type: 'Solo', fee: 75, memberFee: 0, limit: 80, venue: 'Mechanical CAD Lab',
      date: todayHour(4.5), endDate: todayHour(8), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_robotics_upcoming_03', clubKey: 'club_robotics_07',
      name: 'Drone Flight Dynamics & ArduPilot Flight Controllers',
      desc: 'Assembly, ESC calibration, telemetry, and automated waypoint navigation for quadcopters.',
      type: 'Solo', fee: 180, memberFee: 60, limit: 45, venue: 'Aero Hangar 2',
      date: daysOffset(8, 10), endDate: daysOffset(8, 17), deadline: daysOffset(7, 23),
      banner: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_robotics_hackathon_04', clubKey: 'club_robotics_07',
      name: 'RoboWars 8kg Combat Bot Championship',
      desc: 'Full-contact armored combat robot tournament inside a safety polycarbonate arena.',
      type: 'Team', fee: 350, memberFee: 150, limit: 32, venue: 'Indoor Sports Complex',
      date: daysOffset(18, 9), endDate: daysOffset(19, 18), deadline: daysOffset(16, 23),
      banner: 'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_robotics_past_05', clubKey: 'club_robotics_07',
      name: 'Line Follower & Maze Solver Competition (Past)',
      desc: 'Precision micro-robot sprint competition through PID control loops.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 90, venue: 'SAC Quad',
      date: daysOffset(-21, 10), endDate: daysOffset(-21, 17), deadline: daysOffset(-22, 23),
      banner: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1200&h=600&fit=crop',
    },

    // ── 8. Skyline Music
    {
      id: 'ev_music_live_01', clubKey: 'club_music_08',
      name: 'Acoustic Jam Session & Live Mic (Happening Now)',
      desc: 'Open student acoustic sets, vocal harmonies, and unplugged instrumentals on the campus lawns.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 150, venue: 'Amphitheatre',
      date: todayHour(-1.5), endDate: todayHour(4.5), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_music_today_02', clubKey: 'club_music_08',
      name: 'Ableton Live Beatmaking & Electronic Production (Starts Today)',
      desc: 'Synthesizers, MIDI sampling, drum rack sequencing, and stereo mastering fundamentals.',
      type: 'Solo', fee: 60, memberFee: 0, limit: 70, venue: 'Digital Media Studio',
      date: todayHour(5), endDate: todayHour(8.5), deadline: todayHour(4.5),
      banner: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_music_upcoming_03', clubKey: 'club_music_08',
      name: 'Jazz Improvisation & Blues Scales Workshop',
      desc: 'Chord substitution, modal progressions, and call-and-response dynamics for guitar and keys.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 60, venue: 'Music Room 101',
      date: daysOffset(6, 11), endDate: daysOffset(6, 16), deadline: daysOffset(5, 23),
      banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_music_hackathon_04', clubKey: 'club_music_08',
      name: 'Battle of the Campus Bands 2026',
      desc: 'Rock, fusion, and indie student bands competing live on the main outdoor concert stage.',
      type: 'Team', fee: 200, memberFee: 100, limit: 20, venue: 'Main Stadium Stage',
      date: daysOffset(15, 16), endDate: daysOffset(15, 22), deadline: daysOffset(13, 23),
      banner: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_music_past_05', clubKey: 'club_music_08',
      name: 'Winter Acoustic Sunset Showcase (Past)',
      desc: 'End-of-year concert featuring 14 original acoustic student singer-songwriters.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'Lakefront Deck',
      date: daysOffset(-27, 16), endDate: daysOffset(-27, 21), deadline: daysOffset(-28, 23),
      banner: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&h=600&fit=crop',
    },

    // ── 9. Skyline Athletics & Sports Board
    {
      id: 'ev_sports_live_01', clubKey: 'club_sports_09',
      name: 'Inter-Branch 3v3 Basketball Tournament (Happening Now)',
      desc: 'Live high-octane 3v3 half-court championship with live referee score tracking.',
      type: 'Team', fee: 100, memberFee: 30, limit: 32, venue: 'Outdoor Basketball Courts',
      date: todayHour(-2), endDate: todayHour(4), deadline: todayHour(3.5),
      banner: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_sports_today_02', clubKey: 'club_sports_09',
      name: 'Sunset 5K Campus Fitness Run & Pace Clinic (Starts Today)',
      desc: 'Timed 5K campus perimeter run with pace groups, hydration stations, and digital bib tracking.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 200, venue: 'Track & Field Pavilion',
      date: todayHour(5.5), endDate: todayHour(8), deadline: todayHour(5),
      banner: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_sports_upcoming_03', clubKey: 'club_sports_09',
      name: 'Open Table Tennis Singles Knockout',
      desc: 'Single elimination ping pong championship on Olympic-grade Butterfly tables.',
      type: 'Solo', fee: 50, memberFee: 0, limit: 64, venue: 'Indoor Sports Hall A',
      date: daysOffset(7, 10), endDate: daysOffset(7, 18), deadline: daysOffset(6, 23),
      banner: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_sports_hackathon_04', clubKey: 'club_sports_09',
      name: 'Skyline Premier League: 7-a-Side Football Cup',
      desc: '16 departmental football teams battling for the coveted Skyline Athletic Trophy.',
      type: 'Team', fee: 300, memberFee: 150, limit: 16, venue: 'Main Football Turf',
      date: daysOffset(13, 8), endDate: daysOffset(14, 19), deadline: daysOffset(11, 23),
      banner: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_sports_past_05', clubKey: 'club_sports_09',
      name: 'Annual Badminton Doubles Open (Past)',
      desc: '32 doubles teams competed across 3 indoor courts with live umpire boards.',
      type: 'Team', fee: 100, memberFee: 50, limit: 32, venue: 'Badminton Courts',
      date: daysOffset(-23, 9), endDate: daysOffset(-23, 18), deadline: daysOffset(-24, 23),
      banner: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1200&h=600&fit=crop',
    },

    // ── 10. Literary & Debating Society
    {
      id: 'ev_litsoc_live_01', clubKey: 'club_litsoc_10',
      name: 'Parliamentary Debate Knockouts (Happening Now)',
      desc: 'Live 3-on-3 Oxford format parliamentary debates on contemporary tech policy and ethics.',
      type: 'Team', fee: 50, memberFee: 0, limit: 24, venue: 'Senate Hall',
      date: todayHour(-1.5), endDate: todayHour(4.5), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_litsoc_today_02', clubKey: 'club_litsoc_10',
      name: 'Campus Spoken Word Poetry Jam (Starts Today)',
      desc: 'Open evening of rhythm, storytelling, and heartfelt spoken poetry in the library garden.',
      type: 'Solo', fee: 0, memberFee: 0, limit: 100, venue: 'Library Courtyard',
      date: todayHour(4.5), endDate: todayHour(8), deadline: todayHour(4),
      banner: 'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_litsoc_upcoming_03', clubKey: 'club_litsoc_10',
      name: 'Sci-Fi Worldbuilding & Creative Writing Workshop',
      desc: 'Crafting speculative technologies, political tension, and high-stakes character arcs.',
      type: 'Solo', fee: 40, memberFee: 0, limit: 70, venue: 'Seminar Hall 2',
      date: daysOffset(8, 11), endDate: daysOffset(8, 16), deadline: daysOffset(7, 23),
      banner: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_litsoc_hackathon_04', clubKey: 'club_litsoc_10',
      name: 'Model United Nations 2026: Security Council Crisis',
      desc: 'Represent world delegations in emergency crises simulation with live resolutions.',
      type: 'Solo', fee: 200, memberFee: 100, limit: 80, venue: 'Conference Hall A',
      date: daysOffset(16, 9), endDate: daysOffset(17, 18), deadline: daysOffset(14, 23),
      banner: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&h=600&fit=crop',
    },
    {
      id: 'ev_litsoc_past_05', clubKey: 'club_litsoc_10',
      name: 'National Quiz Qualifiers (Past)',
      desc: 'General knowledge, cinema, and history trivia tournament with 50 student duos.',
      type: 'Team', fee: 50, memberFee: 0, limit: 100, venue: 'Main Auditorium',
      date: daysOffset(-26, 10), endDate: daysOffset(-26, 18), deadline: daysOffset(-27, 23),
      banner: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=1200&h=600&fit=crop',
    },
  ];

  const createdEvents: Record<string, any> = {};
  for (const bp of eventBlueprints) {
    const parentClub = clubs[bp.clubKey];
    createdEvents[bp.id] = await prisma.event.upsert({
      where: { id: bp.id },
      update: {
        clubId: parentClub.id,
        name: bp.name,
        description: bp.desc,
        eventType: bp.type,
        fee: bp.fee,
        memberFee: bp.memberFee,
        registrationLimit: bp.limit,
        registrationDeadline: bp.deadline,
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
      create: {
        id: bp.id,
        clubId: parentClub.id,
        name: bp.name,
        description: bp.desc,
        eventType: bp.type,
        fee: bp.fee,
        memberFee: bp.memberFee,
        registrationLimit: bp.limit,
        registrationDeadline: bp.deadline,
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
  }

  // ── 5. Create / Upsert 50 Merchandise Products Across 10 Clubs ───────────────
  console.log('🛍️ Upserting 50 merchandise products with sizes and stock...');

  const merchCatalog = [
    // GDG (5 items)
    { id: 'prod_gdg_01', clubKey: 'club_gdg_01', name: 'GDG Heavyweight Campus Hoodie', desc: 'Heavyweight fleece navy blue hoodie with the official GDG crest.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop' },
    { id: 'prod_gdg_02', clubKey: 'club_gdg_01', name: 'GDG Developer Oversized T-Shirt', desc: '100% bio-washed cotton minimalist tech tee with Google Cloud emblem.', price: 29900, discount: 15, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=600&fit=crop' },
    { id: 'prod_gdg_03', clubKey: 'club_gdg_01', name: 'GDG Waterproof Laptop Sleeve (14-16")', desc: 'Padded neoprene sleeve with dual compartments and anti-scratch lining.', price: 39900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { id: 'prod_gdg_04', clubKey: 'club_gdg_01', name: 'GDG Matte Black Stainless Water Bottle', desc: '750ml double-wall vacuum insulated flask keeping drinks cold for 24h.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop' },
    { id: 'prod_gdg_05', clubKey: 'club_gdg_01', name: 'GDG Holographic Sticker Pack (Set of 10)', desc: 'Matte vinyl waterproof stickers for laptop, keyboard, and phone cases.', price: 9900, discount: 10, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // Rotaract (5 items)
    { id: 'prod_rot_01', clubKey: 'club_rotaract_02', name: 'Rotaract Classic Embroidered Polo', desc: 'Breathable pique cotton collared polo in crisp royal blue.', price: 39900, discount: 15, image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=600&fit=crop' },
    { id: 'prod_rot_02', clubKey: 'club_rotaract_02', name: 'Rotaract Heavy Duty Canvas Tote Bag', desc: 'Eco-friendly organic canvas tote bag with reinforced handles.', price: 19900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { id: 'prod_rot_03', clubKey: 'club_rotaract_02', name: 'Rotaract Ceramic Coffee Mug', desc: '350ml glossy ceramic mug with inspirational leadership quote.', price: 14900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { id: 'prod_rot_04', clubKey: 'club_rotaract_02', name: 'Rotaract Hardcover Bullet Journal', desc: '192-page dotted grid notebook with ribbon bookmark and pen holder.', price: 24900, discount: 10, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { id: 'prod_rot_05', clubKey: 'club_rotaract_02', name: 'Rotaract Silicone Wristband Set (Pack of 3)', desc: 'Durable debossed silicone wristbands in vibrant community colors.', price: 7900, discount: 0, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop' },

    // IEEE (5 items)
    { id: 'prod_ieee_01', clubKey: 'club_ieee_03', name: 'IEEE Circuit Track Bomber Jacket', desc: 'Windproof lightweight nylon jacket featuring subtle copper circuit board prints.', price: 69900, discount: 20, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop' },
    { id: 'prod_ieee_02', clubKey: 'club_ieee_03', name: 'IEEE Technical Cotton T-Shirt', desc: 'Pre-shrunk cotton tee with IEEE student branch technical seal.', price: 28900, discount: 15, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop' },
    { id: 'prod_ieee_03', clubKey: 'club_ieee_03', name: 'IEEE Precision Mousepad (XL Desk Mat)', desc: '900x400mm micro-weave cloth mat with anti-fray stitched edges.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&h=600&fit=crop' },
    { id: 'prod_ieee_04', clubKey: 'club_ieee_03', name: 'IEEE Brass Metal Pin & Lanyard Set', desc: 'High-polish metal lapel pin and woven badge lanyard for conferences.', price: 12900, discount: 10, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { id: 'prod_ieee_05', clubKey: 'club_ieee_03', name: 'IEEE Aluminum Multi-Angle Phone Stand', desc: 'Collapsible desktop aluminum phone and tablet dock.', price: 22900, discount: 10, image: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&h=600&fit=crop' },

    // ACM (5 items)
    { id: 'prod_acm_01', clubKey: 'club_acm_04', name: 'ACM Terminal Dark Mode Hoodie', desc: 'Black zip hoodie featuring monospace ASCII syntax tree on the back.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&h=600&fit=crop' },
    { id: 'prod_acm_02', clubKey: 'club_acm_04', name: 'ACM Algorithms & Big-O T-Shirt', desc: 'Complexity chart graphic tee on charcoal grey heavyweight cotton.', price: 29900, discount: 15, image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=600&fit=crop' },
    { id: 'prod_acm_03', clubKey: 'club_acm_04', name: 'ACM Artisan Mechanical Keycap (Cherry MX)', desc: 'Custom resin artisan keycap featuring the ACM crest for ESC key.', price: 19900, discount: 10, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=600&fit=crop' },
    { id: 'prod_acm_04', clubKey: 'club_acm_04', name: 'ACM Insulated Coffee Tumbler', desc: 'Spill-proof 450ml matte tumbler built for late-night contest coding.', price: 29900, discount: 10, image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&h=600&fit=crop' },
    { id: 'prod_acm_05', clubKey: 'club_acm_04', name: 'ACM Monospace Laptop Decals Pack', desc: 'Die-cut vinyl stickers covering dynamic programming, graph theory & regex.', price: 8900, discount: 0, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // Design (5 items)
    { id: 'prod_des_01', clubKey: 'club_design_05', name: 'DCAG Minimalist French Terry Sweatshirt', desc: 'Clean architectural line embroidery on premium French terry fabric.', price: 49900, discount: 15, image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop' },
    { id: 'prod_des_02', clubKey: 'club_design_05', name: 'DCAG Golden Ratio Oversized Tee', desc: 'Fibonacci spiral diagram printed in subtle silver on ivory cotton.', price: 31900, discount: 10, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=600&fit=crop' },
    { id: 'prod_des_03', clubKey: 'club_design_05', name: 'DCAG Hardbound Sketchbook (180 GSM)', desc: 'Heavyweight bleed-proof paper designed for markers, ink, and pencil sketches.', price: 27900, discount: 15, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
    { id: 'prod_des_04', clubKey: 'club_design_05', name: 'DCAG Enamel Pin Collector Bundle', desc: 'Set of 4 soft enamel pins: Bezier Pen tool, CMYK swatch, Eye-dropper, and Font glyph.', price: 15900, discount: 10, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { id: 'prod_des_05', clubKey: 'club_design_05', name: 'DCAG Ergonomic Mechanical Pencil Set (0.5mm)', desc: 'Matte aluminum draft mechanical pencil set with 2B and HB leads.', price: 18900, discount: 10, image: 'https://images.unsplash.com/photo-1585336261026-7756f3458d69?w=600&h=600&fit=crop' },

    // E-Cell (5 items)
    { id: 'prod_ecell_01', clubKey: 'club_ecell_06', name: 'E-Cell Founders Lightweight Windbreaker', desc: 'Water-resistant zip jacket designed for early-morning pitch summits.', price: 59900, discount: 20, image: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&h=600&fit=crop' },
    { id: 'prod_ecell_02', clubKey: 'club_ecell_06', name: 'E-Cell Pitch Deck Leather Portfolio', desc: 'Vegan leather document holder with notepad sleeve and card organizer.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop' },
    { id: 'prod_ecell_03', clubKey: 'club_ecell_06', name: 'E-Cell "Hustle / Scale" Cotton T-Shirt', desc: 'Minimalist typography screen-printed on organic black cotton.', price: 29900, discount: 10, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=600&fit=crop' },
    { id: 'prod_ecell_04', clubKey: 'club_ecell_06', name: 'E-Cell Matte Wireless Fast Charger (15W)', desc: 'Ultra-thin Qi fast charging pad with non-slip silicone base.', price: 32900, discount: 10, image: 'https://images.unsplash.com/photo-1622445262464-84b24e406223?w=600&h=600&fit=crop' },
    { id: 'prod_ecell_05', clubKey: 'club_ecell_06', name: 'E-Cell Stainless Steel Cardholder Case', desc: 'Slim RFID-blocking metallic business card pocket case.', price: 11900, discount: 0, image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop' },

    // Robotics (5 items)
    { id: 'prod_rob_01', clubKey: 'club_robotics_07', name: 'RAS Carbon Fiber Texture Heavy Hoodie', desc: 'Heavyweight black fleece hoodie with robotic schematic back print.', price: 54900, discount: 20, image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&h=600&fit=crop' },
    { id: 'prod_rob_02', clubKey: 'club_robotics_07', name: 'RAS Precision Hardware Screwdriver Kit (64-in-1)', desc: 'Magnetic S2 steel bits kit built for electronics, drones, and robots.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&h=600&fit=crop' },
    { id: 'prod_rob_03', clubKey: 'club_robotics_07', name: 'RAS Microcontroller Pinout Desk Mat', desc: 'Anti-static ESD-safe rubber mat with resistor color codes and GPIO tables.', price: 39900, discount: 15, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&h=600&fit=crop' },
    { id: 'prod_rob_04', clubKey: 'club_robotics_07', name: 'RAS High-Grip Safety Eyewear & Lanyard', desc: 'Anti-fog polycarbonate protective goggles for hardware fabrication bays.', price: 14900, discount: 10, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&h=600&fit=crop' },
    { id: 'prod_rob_05', clubKey: 'club_robotics_07', name: 'RAS Robotics Glow-in-the-Dark Sticker Pack', desc: 'Fluorescent high-durability stickers of robotic limbs, gears, and sensors.', price: 8900, discount: 0, image: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=600&h=600&fit=crop' },

    // Music (5 items)
    { id: 'prod_mus_01', clubKey: 'club_music_08', name: 'Skyline Music Oversized Vintage Band Tee', desc: 'Washed charcoal vintage cotton tee celebrating campus acoustic fests.', price: 32900, discount: 15, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&h=600&fit=crop' },
    { id: 'prod_mus_02', clubKey: 'club_music_08', name: 'Skyline Music Heavy Canvas Gig Bag Patch', desc: 'Embroidered iron-on patch for instrument gig cases and denim jackets.', price: 9900, discount: 0, image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop' },
    { id: 'prod_mus_03', clubKey: 'club_music_08', name: 'Skyline Music Celluloid Guitar Picks (Set of 12)', desc: 'Assorted gauges (0.71mm to 1.14mm) with grip texture in vintage tin.', price: 12900, discount: 10, image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop' },
    { id: 'prod_mus_04', clubKey: 'club_music_08', name: 'Skyline Music Noise-Isolating Earplugs Case', desc: 'High-fidelity acoustic attenuation earplugs with keychain aluminum pod.', price: 24900, discount: 10, image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&h=600&fit=crop' },
    { id: 'prod_mus_05', clubKey: 'club_music_08', name: 'Skyline Music Corduroy Musician Cap', desc: 'Embroidered waveform emblem on unstructured six-panel corduroy.', price: 29900, discount: 10, image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop' },

    // Sports (5 items)
    { id: 'prod_spt_01', clubKey: 'club_sports_09', name: 'Skyline Athletics Dry-Fit Performance Jersey', desc: 'Moisture-wicking breathable micro-mesh training jersey in deep navy.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=600&fit=crop' },
    { id: 'prod_spt_02', clubKey: 'club_sports_09', name: 'Skyline Athletics 1000ml Tritan Sports Bottle', desc: 'BPA-free shatterproof water bottle with one-touch pop lid and volume markers.', price: 24900, discount: 10, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop' },
    { id: 'prod_spt_03', clubKey: 'club_sports_09', name: 'Skyline Athletics Compact Gym Duffle Bag', desc: '40L water-resistant duffle with dedicated ventilated shoe compartment.', price: 44900, discount: 20, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop' },
    { id: 'prod_spt_04', clubKey: 'club_sports_09', name: 'Skyline Athletics Microfiber Quick-Dry Towel', desc: 'Ultra-absorbent antibacterial microfiber gym towel with zip pocket.', price: 16900, discount: 10, image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&h=600&fit=crop' },
    { id: 'prod_spt_05', clubKey: 'club_sports_09', name: 'Skyline Athletics Cotton Sweatband Set (Wrist + Head)', desc: 'Thick elastic terrycloth sweatbands for court and track sports.', price: 11900, discount: 0, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop' },

    // LitSoc (5 items)
    { id: 'prod_lit_01', clubKey: 'club_litsoc_10', name: 'LitSoc "Between The Lines" Heavy Sweatshirt', desc: 'Minimalist typography embroidery on heavy cream French terry cotton.', price: 49900, discount: 15, image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop' },
    { id: 'prod_lit_02', clubKey: 'club_litsoc_10', name: 'LitSoc Heavy Canvas Book Lover Tote', desc: 'Structured heavyweight cotton canvas bag with inner zipped pocket.', price: 21900, discount: 10, image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop' },
    { id: 'prod_lit_03', clubKey: 'club_litsoc_10', name: 'LitSoc Brass Filigree Bookmark Set (Pack of 3)', desc: 'Laser-etched vintage metal bookmarks with tassel accents.', price: 13900, discount: 10, image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=600&fit=crop' },
    { id: 'prod_lit_04', clubKey: 'club_litsoc_10', name: 'LitSoc Ceramic Writer Mug (400ml)', desc: 'Handcrafted stoneware ceramic mug with quote on creative perseverance.', price: 17900, discount: 10, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop' },
    { id: 'prod_lit_05', clubKey: 'club_litsoc_10', name: 'LitSoc Fountain Pen & Leather Journal Bundle', desc: 'Refillable cartridge fountain pen paired with 240-page lined notebook.', price: 34900, discount: 15, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=600&fit=crop' },
  ];

  for (const m of merchCatalog) {
    const parentClub = clubs[m.clubKey];
    const prod = await prisma.product.upsert({
      where: { id: m.id },
      update: {
        clubId: parentClub.id,
        name: m.name,
        description: m.desc,
        imageUrl: m.image,
        pricePaise: m.price,
        memberDiscountPercent: m.discount,
        isPublished: true,
      },
      create: {
        id: m.id,
        clubId: parentClub.id,
        name: m.name,
        description: m.desc,
        imageUrl: m.image,
        pricePaise: m.price,
        memberDiscountPercent: m.discount,
        isPublished: true,
      },
    });

    const standardVariants = [
      { label: 'S', stock: 15 },
      { label: 'M', stock: 25 },
      { label: 'L', stock: 20 },
      { label: 'XL', stock: 10 },
    ];

    for (const v of standardVariants) {
      await prisma.productVariant.upsert({
        where: {
          productId_label: {
            productId: prod.id,
            label: v.label,
          },
        },
        update: { stock: v.stock },
        create: {
          productId: prod.id,
          label: v.label,
          stock: v.stock,
        },
      });
    }
  }

  // ── 6. Upsert Registrations & Tickets for Demo Student Alex Rivera ────────────
  console.log('🎟️ Upserting tickets & registrations for student@college.edu...');

  // 6.1 Team Registration for Starts-Today GDG Event
  const todayEvent = createdEvents['ev_gdg_today_02'];
  const todayTeam = await prisma.team.upsert({
    where: { id: 'team_bytecraft_01' },
    update: { eventId: todayEvent.id },
    create: {
      id: 'team_bytecraft_01',
      eventId: todayEvent.id,
      teamName: 'Team ByteCraft',
      passkey: 'BYTE2026',
      leaderId: demoStudent.id,
    },
  });

  await prisma.registration.upsert({
    where: {
      eventId_userId: {
        eventId: todayEvent.id,
        userId: demoStudent.id,
      },
    },
    update: {
      status: RegistrationStatus.CONFIRMED,
      checkedInAt: new Date(),
    },
    create: {
      eventId: todayEvent.id,
      userId: demoStudent.id,
      teamId: todayTeam.id,
      status: RegistrationStatus.CONFIRMED,
      feeCharged: todayEvent.memberFee ?? todayEvent.fee,
      isMemberPrice: true,
      transactionId: 'UPI-TXN-ALEX-JAM-01',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
      checkedInAt: new Date(),
    },
  });

  // 6.2 Solo Registration for Upcoming IEEE Event
  const upcomingIeee = createdEvents['ev_ieee_upcoming_03'];
  await prisma.registration.upsert({
    where: {
      eventId_userId: {
        eventId: upcomingIeee.id,
        userId: demoStudent.id,
      },
    },
    update: { status: RegistrationStatus.CONFIRMED },
    create: {
      eventId: upcomingIeee.id,
      userId: demoStudent.id,
      status: RegistrationStatus.CONFIRMED,
      feeCharged: upcomingIeee.fee,
      isMemberPrice: false,
      transactionId: 'UPI-TXN-ALEX-IEEE-SOLO',
      paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=800&fit=crop',
    },
  });

  // 6.3 Bookmark/Save events for the student
  await prisma.savedEvent.createMany({
    data: [
      { userId: demoStudent.id, eventId: createdEvents['ev_gdg_hackathon_04'].id },
      { userId: demoStudent.id, eventId: createdEvents['ev_acm_today_02'].id },
      { userId: demoStudent.id, eventId: createdEvents['ev_design_upcoming_03'].id },
    ],
    skipDuplicates: true,
  });

  // ── 7. Seed Real Cryptographic Ledger Entries ───────────────────────────────
  console.log('💎 Seeding audited ledger entries into SHA-256 hash chain...');

  const existingDuesEntry = await prisma.ledgerEntry.findFirst({
    where: { refType: 'MEMBERSHIP_DUES', refId: `dues_${demoStudent.id}` },
  });

  if (!existingDuesEntry) {
    // 7.1 Membership Dues (IN)
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

    // 7.2 Ticket Sale for Event (IN)
    await postLedger({
      clubId: clubs['club_gdg_01'].id,
      type: 'IN',
      category: 'TICKET',
      amountPaise: 5000,
      refType: 'TICKET_SALE',
      refId: `ticket_${todayEvent.id}_${demoStudent.id}`,
      eventId: todayEvent.id,
      actorId: demoStudent.id,
      memo: 'Android Studio Jellyfish Jam - Alex Rivera (Member Discounted)',
    });

    // 7.3 Sample Expense Claim & Reimbursement
    const sampleClaim = await prisma.expenseClaim.upsert({
      where: { id: 'claim_seed_reimbursed_01' },
      update: {},
      create: {
        id: 'claim_seed_reimbursed_01',
        clubId: clubs['club_gdg_01'].id,
        claimantId: clubHeadProfiles['club_gdg_01'].id,
        title: 'DevFest Stage Banners & Standees',
        vendor: 'Campus Print Graphics',
        amountPaise: 12500,
        scannedAmount: 12500,
        category: 'EXPENSE',
        eventId: createdEvents['ev_gdg_live_01'].id,
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
      eventId: createdEvents['ev_gdg_live_01'].id,
      actorId: clubHeadProfiles['club_gdg_01'].id,
      memo: `Reimbursement for Claim #${sampleClaim.id}: ${sampleClaim.title}`,
    });
  }

  // ── 8. Create Notifications for Demo Student ────────────────────────────────
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: demoStudent.id,
        eventId: todayEvent.id,
        type: 'REGISTRATION_CONFIRMED',
        title: 'Registration Confirmed: Android Studio Jellyfish Jam',
        body: 'Your ticket for Android Studio Jellyfish Jam with team ByteCraft is confirmed! Show your QR code at the door.',
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
    skipDuplicates: true,
  });

  // ── 9. Verify Cryptographic Integrity ──────────────────────────────────────
  console.log('🔒 Verifying cryptographic ledger chain integrity...');
  const chainAudit = await verifyChain();
  if (!chainAudit.valid) {
    throw new Error(`Ledger integrity check failed! Reason: ${chainAudit.reason}`);
  }

  console.log(`✅ Ledger Chain Intact: ${chainAudit.entryCount} entries verified with Head: ${chainAudit.headHash.slice(0, 16)}...`);
  console.log('\n=============================================================');
  console.log('🎉 ADDITIVE SEEDING COMPLETE! DATASET OVERVIEW:');
  console.log(`   🏛️ Clubs: 10 campus clubs available`);
  console.log(`   📅 Events: 50 events created`);
  console.log(`      • 10 Live Events (date <= now <= endDate -> Live Tab)`);
  console.log(`      • 30 Upcoming Events (10 Starts-Today + 20 Future -> Upcoming Tab, Open Registration)`);
  console.log(`      • 10 Past Events (endDate < now -> Past Tab)`);
  console.log(`   🛍️ Merch: 50 products created with active variants`);
  console.log(`   👤 Demo Accounts preserved & ready:`);
  console.log(`      • Student: student@college.edu / Password@123 (Alex Rivera)`);
  console.log(`      • Admin:   admin@skyline.local / Password@123`);
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
