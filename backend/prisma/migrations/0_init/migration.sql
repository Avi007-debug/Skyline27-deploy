-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "usn" TEXT,
    "branch" TEXT,
    "phone" TEXT,
    "year" INTEGER,
    "sem" INTEGER,
    "club_id" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "logo_url" TEXT,
    "password" TEXT,
    "qr_url" TEXT,
    "upi_id" TEXT,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registration_limit" INTEGER NOT NULL,
    "registration_deadline" TIMESTAMP(3) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "qr_url" TEXT,
    "banner_url" TEXT,
    "venue" TEXT,
    "team_size_limit" INTEGER,
    "min_team_size" INTEGER,
    "event_end_date" TIMESTAMP(3),
    "upi_id" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "passkey" TEXT,
    "leader_id" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "payment_proof_url" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT,
    "checked_in_at" TIMESTAMP(3),

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationKey" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_by_club_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "RegistrationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profile_usn_key" ON "Profile"("usn");

-- CreateIndex
CREATE INDEX "idx_profile_club" ON "Profile"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_email_key" ON "Club"("email");

-- CreateIndex
CREATE INDEX "idx_event_club" ON "Event"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_passkey_key" ON "Team"("passkey");

-- CreateIndex
CREATE INDEX "idx_team_event" ON "Team"("event_id");

-- CreateIndex
CREATE INDEX "idx_registration_event" ON "Registration"("event_id");

-- CreateIndex
CREATE INDEX "idx_registration_profile" ON "Registration"("user_id");

-- CreateIndex
CREATE INDEX "idx_registration_team" ON "Registration"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_event_user_registration" ON "Registration"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_notification_event" ON "Notification"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrationkey_code_key" ON "RegistrationKey"("code");

-- CreateIndex
CREATE INDEX "idx_registrationkey_club" ON "RegistrationKey"("used_by_club_id");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "fk_profile_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "fk_event_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "fk_team_event" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "fk_registration_event" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "fk_registration_profile" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "fk_registration_team" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "fk_notification_event" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationKey" ADD CONSTRAINT "fk_registrationkey_club" FOREIGN KEY ("used_by_club_id") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
