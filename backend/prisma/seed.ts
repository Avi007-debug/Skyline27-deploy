import { PrismaClient, RegistrationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const dbMode = (process.env.DB_MODE || process.env.DB_ENV || '').toLowerCase().trim();
let connectionString = process.env.DATABASE_URL || '';
if (dbMode === 'local' && process.env.LOCAL_DATABASE_URL) {
  connectionString = process.env.LOCAL_DATABASE_URL;
} else if ((dbMode === 'supabase' || !dbMode) && process.env.SUPABASE_DATABASE_URL) {
  connectionString = process.env.SUPABASE_DATABASE_URL;
}

const isCloudPostgres =
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('sslmode=require');

const sanitizedConnectionString = isCloudPostgres
  ? connectionString.replace(/[?&]sslmode=[^&]+/g, '')
  : connectionString;

const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`\n🌱 Seeding database [Target: ${connectionString.includes('localhost') ? 'Local PostgreSQL' : 'Supabase PostgreSQL'}]...`);

  // 1. Clean existing records in correct order
  console.log('🧹 Cleaning existing test data...');
  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.team.deleteMany();
  await prisma.event.deleteMany();
  await prisma.registrationKey.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.club.deleteMany();

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 2. Create Clubs (including GDG)
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

  // 3. Create Profiles (Admins & Students)
  console.log('👤 Creating user profiles...');
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
    },
  });

  // 4. Create Events
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

  // 5. Create Teams & Registrations
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

  // 6. Create Registration Keys
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

  // 7. Create Notifications
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
        userId: student2.id,
        eventId: rotaractEvent.id,
        type: 'REGISTRATION_CONFIRMED',
        title: 'Welcome to Skyline Youth Impact Summit',
        body: 'Your ticket has been confirmed. Please bring your college ID card on the event day.',
        isRead: true,
      },
    ],
  });

  console.log('\n✨ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
