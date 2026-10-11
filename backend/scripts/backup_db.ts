import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import prisma from '../config/db';

async function backupDatabase() {
  console.log('📦 Starting database state snapshot...');

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `db_backup_${timestamp}.json`);
  const latestBackupFile = path.join(backupDir, 'db_backup_latest.json');

  const snapshot: Record<string, any> = {
    metadata: {
      exportedAt: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    tables: {},
  };

  try {
    const [
      clubs,
      profiles,
      registrationKeys,
      events,
      teams,
      registrations,
      notifications,
      savedEvents,
      eventTasks,
      announcements,
      products,
      productVariants,
      orders,
      memberships,
      expenseClaims,
      ledgerHeads,
      ledgerEntries,
      auditLogs,
    ] = await Promise.all([
      prisma.club.findMany(),
      prisma.profile.findMany(),
      prisma.registrationKey.findMany(),
      prisma.event.findMany(),
      prisma.team.findMany(),
      prisma.registration.findMany(),
      prisma.notification.findMany(),
      prisma.savedEvent.findMany(),
      prisma.eventTask.findMany(),
      prisma.announcement.findMany(),
      prisma.product.findMany(),
      prisma.productVariant.findMany(),
      prisma.order.findMany(),
      prisma.membership.findMany(),
      prisma.expenseClaim.findMany(),
      prisma.ledgerHead.findMany(),
      prisma.ledgerEntry.findMany(),
      prisma.auditLog.findMany(),
    ]);

    snapshot.tables = {
      Club: clubs,
      Profile: profiles,
      RegistrationKey: registrationKeys,
      Event: events,
      Team: teams,
      Registration: registrations,
      Notification: notifications,
      SavedEvent: savedEvents,
      EventTask: eventTasks,
      Announcement: announcements,
      Product: products,
      ProductVariant: productVariants,
      Order: orders,
      Membership: memberships,
      ExpenseClaim: expenseClaims,
      LedgerHead: ledgerHeads,
      LedgerEntry: ledgerEntries,
      AuditLog: auditLogs,
    };

    const counts = Object.entries(snapshot.tables).map(([k, v]: [string, any]) => `${k}: ${v.length}`).join(', ');
    console.log(`📊 Snapshot table row counts: ${counts}`);

    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.writeFileSync(latestBackupFile, JSON.stringify(snapshot, null, 2), 'utf-8');

    console.log(`✅ Database backup saved successfully to:\n   ${backupFile}\n   ${latestBackupFile}`);
  } catch (err) {
    console.error('❌ Failed to backup database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
