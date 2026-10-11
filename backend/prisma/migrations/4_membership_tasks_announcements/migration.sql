-- Migration: club memberships (with member pricing), volunteer tasks and announcements.
-- Additive only: no existing rows or columns are changed except the Registration fee backfill.


-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('MEETING', 'DEADLINE', 'GENERAL');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "membership_fee_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "membership_months" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "member_fee" DOUBLE PRECISION,
ADD COLUMN     "task_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "task_done_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "is_member_price" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "member_discount_percent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "fee_charged" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "is_member_price" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "dues_paid_paise" INTEGER NOT NULL,
    "payment_proof_url" TEXT,
    "transaction_id" TEXT,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTask" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assigned_to_id" TEXT,
    "created_by_id" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "author_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_transaction_id_key" ON "Membership"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_membership_user_club" ON "Membership"("user_id", "club_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "idx_membership_club_status" ON "Membership"("club_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "idx_membership_verifier" ON "Membership"("verified_by_id");

-- CreateIndex
CREATE INDEX "idx_task_event_status" ON "EventTask"("event_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_task_assignee" ON "EventTask"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "idx_task_creator" ON "EventTask"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_announcement_club_created" ON "Announcement"("club_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_announcement_author" ON "Announcement"("author_id");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "fk_membership_user" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "fk_membership_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "fk_membership_verifier" FOREIGN KEY ("verified_by_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "fk_task_event" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "fk_task_assignee" FOREIGN KEY ("assigned_to_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "fk_task_creator" FOREIGN KEY ("created_by_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "fk_announcement_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "fk_announcement_author" FOREIGN KEY ("author_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing registrations were charged the event's normal fee.
UPDATE "Registration" r SET fee_charged = e.fee FROM "Event" e WHERE e.id = r.event_id AND r.fee_charged = 0 AND e.fee > 0;

-- Volunteer task counters on Event (total / done), kept by deltas like the other counters.
UPDATE "Event" e SET
  task_count      = (SELECT count(*) FROM "EventTask" t WHERE t.event_id = e.id),
  task_done_count = (SELECT count(*) FROM "EventTask" t WHERE t.event_id = e.id AND t.status = 'DONE');

CREATE OR REPLACE FUNCTION trg_task_counts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.event_id = NEW.event_id THEN
    RETURN NULL;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE "Event" SET
      task_count      = GREATEST(0, task_count - 1),
      task_done_count = GREATEST(0, task_done_count - (OLD.status = 'DONE')::int)
    WHERE id = OLD.event_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE "Event" SET
      task_count      = task_count + 1,
      task_done_count = task_done_count + (NEW.status = 'DONE')::int
    WHERE id = NEW.event_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_counts ON "EventTask";
CREATE TRIGGER trg_task_counts
  AFTER INSERT OR DELETE OR UPDATE OF status, event_id ON "EventTask"
  FOR EACH ROW EXECUTE FUNCTION trg_task_counts();

-- A student can have only one membership payment awaiting review per club. The advisory lock makes
-- two simultaneous submissions queue up instead of both passing the check.
CREATE OR REPLACE FUNCTION trg_membership_one_pending() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'PENDING' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id || ':' || NEW.club_id));
    IF EXISTS (
      SELECT 1 FROM "Membership" m
      WHERE m.user_id = NEW.user_id AND m.club_id = NEW.club_id AND m.status = 'PENDING' AND m.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'A membership payment for this club is already awaiting review' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_membership_one_pending ON "Membership";
CREATE TRIGGER trg_membership_one_pending
  BEFORE INSERT OR UPDATE OF status, user_id, club_id ON "Membership"
  FOR EACH ROW EXECUTE FUNCTION trg_membership_one_pending();

-- Integrity CHECKs (all columns are new, so they are fully validated).
ALTER TABLE "Club" DROP CONSTRAINT IF EXISTS chk_club_membership;
ALTER TABLE "Club" ADD CONSTRAINT chk_club_membership CHECK (membership_fee_paise >= 0 AND membership_months BETWEEN 1 AND 60);
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS chk_event_member_fee;
ALTER TABLE "Event" ADD CONSTRAINT chk_event_member_fee CHECK (member_fee IS NULL OR member_fee >= 0);
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS chk_event_task_counts;
ALTER TABLE "Event" ADD CONSTRAINT chk_event_task_counts CHECK (task_count >= 0 AND task_done_count >= 0 AND task_done_count <= task_count);
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS chk_product_member_discount;
ALTER TABLE "Product" ADD CONSTRAINT chk_product_member_discount CHECK (member_discount_percent BETWEEN 0 AND 100);
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS chk_registration_fee_charged;
ALTER TABLE "Registration" ADD CONSTRAINT chk_registration_fee_charged CHECK (fee_charged >= 0);
ALTER TABLE "Membership" DROP CONSTRAINT IF EXISTS chk_membership_dues;
ALTER TABLE "Membership" ADD CONSTRAINT chk_membership_dues CHECK (dues_paid_paise >= 0);
ALTER TABLE "Membership" DROP CONSTRAINT IF EXISTS chk_membership_active_dates;
ALTER TABLE "Membership" ADD CONSTRAINT chk_membership_active_dates
  CHECK (status <> 'ACTIVE' OR (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date > start_date));

-- Safety net: a registration inserted without a charged fee (seeds, scripts) is charged the event's normal
-- fee. A deliberate free member price is kept because it is flagged is_member_price.
CREATE OR REPLACE FUNCTION trg_registration_club() RETURNS trigger AS $$
DECLARE ev RECORD;
BEGIN
  SELECT club_id, fee INTO ev FROM "Event" WHERE id = NEW.event_id;
  IF NEW.club_id IS NULL THEN
    NEW.club_id := ev.club_id;
  END IF;
  IF NEW.fee_charged = 0 AND NOT NEW.is_member_price AND ev.fee > 0 THEN
    NEW.fee_charged := ev.fee;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
