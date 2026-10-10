import prisma from '../config/db';

export async function applyDatabaseConstraintsAndViews() {
  console.log('🛡️ Applying PostgreSQL Append-Only Ledger Trigger, Constraints & Views...');

  // 1. Immutable Trigger on LedgerEntry
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION trg_prevent_ledger_tampering()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Ledger entries are immutable and append-only. UPDATE and DELETE operations are forbidden.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_ledger_immutable ON "LedgerEntry";
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_ledger_immutable
    BEFORE UPDATE OR DELETE ON "LedgerEntry"
    FOR EACH ROW
    EXECUTE FUNCTION trg_prevent_ledger_tampering();
  `);
  console.log('  ✅ Created immutable trigger on LedgerEntry (blocks UPDATE and DELETE)');

  // 2. CHECK Constraints (> 0 amounts)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "LedgerEntry" DROP CONSTRAINT IF EXISTS chk_ledger_positive_amount;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "LedgerEntry" ADD CONSTRAINT chk_ledger_positive_amount CHECK ("amount_paise" > 0);
  `);
  console.log('  ✅ Added CHECK constraint chk_ledger_positive_amount (amount_paise > 0)');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ExpenseClaim" DROP CONSTRAINT IF EXISTS chk_claim_positive_amount;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ExpenseClaim" ADD CONSTRAINT chk_claim_positive_amount CHECK ("amount_paise" > 0);
  `);
  console.log('  ✅ Added CHECK constraint chk_claim_positive_amount (amount_paise > 0)');

  // 3. Reporting Views
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW v_ledger_by_category AS
    SELECT 
      category, 
      type, 
      COUNT(*) AS transaction_count, 
      SUM(amount_paise) AS total_amount_paise
    FROM "LedgerEntry"
    GROUP BY category, type;
  `);
  console.log('  ✅ Created view v_ledger_by_category');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW v_event_pnl AS
    SELECT 
      e.id AS event_id,
      e.name AS event_name,
      COALESCE(SUM(CASE WHEN l.type = 'IN' THEN l.amount_paise ELSE 0 END), 0) AS total_revenue_paise,
      COALESCE(SUM(CASE WHEN l.type = 'OUT' THEN l.amount_paise ELSE 0 END), 0) AS total_expense_paise,
      COALESCE(SUM(CASE WHEN l.type = 'IN' THEN l.amount_paise ELSE -l.amount_paise END), 0) AS net_result_paise
    FROM "Event" e
    LEFT JOIN "LedgerEntry" l ON e.id = l.event_id
    GROUP BY e.id, e.name;
  `);
  console.log('  ✅ Created view v_event_pnl');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW v_owed_to_volunteers AS
    SELECT 
      c.id,
      c.claimant_id,
      p.full_name,
      p.email,
      c.title,
      c.amount_paise,
      c.receipt_url,
      c.created_at
    FROM "ExpenseClaim" c
    JOIN "Profile" p ON c.claimant_id = p.id
    WHERE c.status = 'APPROVED';
  `);
  console.log('  ✅ Created view v_owed_to_volunteers');

  console.log('✨ All PostgreSQL integrity triggers, constraints and views applied successfully!');
}

if (require.main === module) {
  applyDatabaseConstraintsAndViews()
    .catch((err) => {
      console.error('Error applying constraints:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
