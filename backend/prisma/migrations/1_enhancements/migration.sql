-- Migration: SkylineOS Platform Enhancements
-- Adds: SUPER_ADMIN/CLUB_HEAD/STUDENT roles, optional registration deadline,
--       event publication controls, archive flag, password reset fields

-- 1. Add new Role enum values (PostgreSQL ALTER TYPE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STUDENT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
    ALTER TYPE "Role" ADD VALUE 'STUDENT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLUB_HEAD' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
    ALTER TYPE "Role" ADD VALUE 'CLUB_HEAD';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SUPER_ADMIN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
    ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
  END IF;
END $$;

-- 2. Make registrationDeadline optional (nullable)
ALTER TABLE "Event" ALTER COLUMN "registration_deadline" DROP NOT NULL;

-- 3. Add new Event columns
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "registration_closed_manually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- 4. Add password reset fields to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "password_reset_expiry" TIMESTAMPTZ;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_event_published" ON "Event"("is_published");
CREATE INDEX IF NOT EXISTS "idx_event_archived" ON "Event"("is_archived");
