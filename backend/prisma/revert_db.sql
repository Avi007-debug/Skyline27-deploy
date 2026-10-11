-- =============================================================================
-- SkylineOS Database Revert & Clean Query
-- Cleans all seeded events, merchandise, clubs, registrations, and transactions.
-- Safely disables the immutable ledger trigger during reset, restores genesis state,
-- and re-enables all constraints.
-- =============================================================================

BEGIN;

-- 1. Temporarily disable the immutable ledger trigger if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
    ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_ledger_immutable;
  END IF;
END $$;

-- 2. Clean child tables first to respect foreign key constraints
DELETE FROM "AuditLog";
DELETE FROM "ExpenseClaim";
DELETE FROM "LedgerEntry";
DELETE FROM "LedgerHead";
DELETE FROM "Order";
DELETE FROM "ProductVariant";
DELETE FROM "Product";
DELETE FROM "Notification";
DELETE FROM "SavedEvent";
DELETE FROM "EventTask";
DELETE FROM "Announcement";
DELETE FROM "Membership";
DELETE FROM "Registration";
DELETE FROM "Team";
DELETE FROM "Event";
DELETE FROM "RegistrationKey";
DELETE FROM "Profile";
DELETE FROM "Club";

-- 3. Reset auto-increment sequence on LedgerEntry
ALTER SEQUENCE IF EXISTS "LedgerEntry_id_seq" RESTART WITH 1;

-- 4. Re-initialize LedgerHead to the 64-character Genesis Hash
INSERT INTO "LedgerHead" ("id", "last_hash")
VALUES (1, '0000000000000000000000000000000000000000000000000000000000000000');

-- 5. Re-enable the immutable ledger trigger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_immutable') THEN
    ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable;
  END IF;
END $$;

COMMIT;

-- Verification check:
SELECT 
  (SELECT COUNT(*) FROM "Club") AS clubs_count,
  (SELECT COUNT(*) FROM "Event") AS events_count,
  (SELECT COUNT(*) FROM "Product") AS products_count,
  (SELECT COUNT(*) FROM "Profile") AS profiles_count,
  (SELECT last_hash FROM "LedgerHead" WHERE id = 1) AS genesis_hash;
