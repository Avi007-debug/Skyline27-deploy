import prisma from '../config/db';
import { GENESIS_HASH } from '../modules/finance/ledger.service';

async function revertDatabase() {
  console.log('🔄 Reverting & cleaning SkylineOS database...');

  // 1. Temporarily disable ledger trigger
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
        ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_ledger_immutable;
      END IF;
    END $$;
  `).catch(() => {});

  // 2. Delete all records in foreign key dependency order
  await prisma.auditLog.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerHead.deleteMany();
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

  // 3. Reset Ledger sequence & re-initialize LedgerHead genesis
  await prisma.$executeRawUnsafe(`
    ALTER SEQUENCE IF EXISTS "LedgerEntry_id_seq" RESTART WITH 1;
  `).catch(() => {});

  await prisma.ledgerHead.create({
    data: { id: 1, lastHash: GENESIS_HASH },
  });

  // 4. Re-enable ledger trigger
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
        ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable;
      END IF;
    END $$;
  `).catch(() => {});

  console.log('✅ Database reverted cleanly. All demo data purged and LedgerHead reset to Genesis hash.');
}

revertDatabase()
  .catch((e) => {
    console.error('❌ Revert failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
