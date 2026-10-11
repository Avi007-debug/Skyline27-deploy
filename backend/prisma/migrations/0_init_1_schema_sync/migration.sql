-- Migration: schema sync for objects that were added with `prisma db push`
-- and never captured in a migration (Role enum + Profile.role, the finance
-- ledger tables and AuditLog). `1_enhancements` depends on the "Role" type,
-- so this must run first on a fresh database.
--
-- Every statement is idempotent, so it is a no-op on databases that already
-- have these objects (e.g. developer databases created with `db push`).

-- Enums
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('STUDENT', 'MEMBER', 'VOLUNTEER', 'TREASURER', 'CLUB_HEAD', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerType" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profile.role
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'STUDENT';

-- Ledger
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "club_id" TEXT,
    "type" "LedgerType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "event_id" TEXT,
    "project_id" TEXT,
    "memo" TEXT,
    "actor_id" TEXT,
    "reverses_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prev_hash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LedgerHead" (
    "id" INTEGER NOT NULL,
    "last_hash" CHAR(64) NOT NULL,

    CONSTRAINT "LedgerHead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "club_id" TEXT,
    "claimant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor" TEXT,
    "amount_paise" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'EXPENSE',
    "event_id" TEXT,
    "project_id" TEXT,
    "date_spent" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_url" TEXT NOT NULL,
    "scanned_amount" INTEGER,
    "mismatch_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approver_id" TEXT,
    "decision_note" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerEntry_hash_key" ON "LedgerEntry"("hash");
CREATE INDEX IF NOT EXISTS "idx_ledger_category" ON "LedgerEntry"("category");
CREATE INDEX IF NOT EXISTS "idx_ledger_event" ON "LedgerEntry"("event_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_club" ON "LedgerEntry"("club_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_ledger_ref" ON "LedgerEntry"("ref_type", "ref_id", "type");
CREATE INDEX IF NOT EXISTS "idx_expense_claimant" ON "ExpenseClaim"("claimant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_status" ON "ExpenseClaim"("status");
CREATE INDEX IF NOT EXISTS "idx_expense_club" ON "ExpenseClaim"("club_id");
CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "AuditLog"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_actor" ON "AuditLog"("actor_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseClaim_claimant_id_fkey') THEN
    ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseClaim_approver_id_fkey') THEN
    ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actor_id_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
