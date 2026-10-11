-- Migration: server-side saved (bookmarked) events. Additive only.

-- CreateTable
CREATE TABLE "SavedEvent" (
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_saved_event" PRIMARY KEY ("user_id","event_id")
);

-- CreateIndex
CREATE INDEX "idx_saved_event" ON "SavedEvent"("event_id");

-- AddForeignKey
ALTER TABLE "SavedEvent" ADD CONSTRAINT "fk_saved_user" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedEvent" ADD CONSTRAINT "fk_saved_event" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

