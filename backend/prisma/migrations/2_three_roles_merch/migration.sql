-- Migration: three-role RBAC, account/club status, registration window,
-- registration-key metadata and merchandise (products, variants, orders).
-- Additive except for the Role enum, whose legacy values are folded into
-- the three application roles (data is mapped, not dropped).

-- 1. Collapse Role to exactly STUDENT / CLUB_HEAD / SUPER_ADMIN.
--    SUPER_ADMIN stays SUPER_ADMIN; anyone linked to a club becomes that
--    club's CLUB_HEAD; everyone else (MEMBER, VOLUNTEER, TREASURER, ADMIN
--    without a club) becomes STUDENT.
ALTER TYPE "Role" RENAME TO "Role_legacy";
CREATE TYPE "Role" AS ENUM ('STUDENT', 'CLUB_HEAD', 'SUPER_ADMIN');
ALTER TABLE "Profile" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Profile" ALTER COLUMN "role" TYPE "Role" USING (
  CASE
    WHEN "role"::text = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
    WHEN "club_id" IS NOT NULL THEN 'CLUB_HEAD'
    ELSE 'STUDENT'
  END
)::"Role";
ALTER TABLE "Profile" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
DROP TYPE "Role_legacy";

-- 2. Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Profile" ALTER COLUMN "password_reset_expiry" TYPE TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "idx_profile_role" ON "Profile"("role");

-- 3. Club archive flag
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- 4. Event registration opening date (closing date stays optional)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "registration_opens_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "idx_event_date" ON "Event"("event_date");

-- 5. Registration key metadata
ALTER TABLE "RegistrationKey" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "RegistrationKey" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- 6. Merchandise
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'CANCELLED', 'REJECTED');

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "club_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "price_paise" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_product_price_non_negative" CHECK ("price_paise" >= 0)
);

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "price_paise_override" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_variant_stock_non_negative" CHECK ("stock" >= 0)
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "club_id" TEXT,
    "product_id" TEXT,
    "variant_id" TEXT,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_label" TEXT NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "transaction_id" TEXT,
    "verified_by_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_order_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "chk_order_total_consistent" CHECK ("total_paise" = "unit_price_paise" * "quantity")
);

CREATE INDEX "idx_product_club" ON "Product"("club_id");
CREATE INDEX "idx_product_visibility" ON "Product"("is_published", "is_archived");
CREATE UNIQUE INDEX "unique_variant_label" ON "ProductVariant"("product_id", "label");
CREATE UNIQUE INDEX "order_transaction_id_key" ON "Order"("transaction_id");
CREATE INDEX "idx_order_user" ON "Order"("user_id");
CREATE INDEX "idx_order_club" ON "Order"("club_id");
CREATE INDEX "idx_order_status" ON "Order"("status");

ALTER TABLE "Product" ADD CONSTRAINT "fk_product_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "fk_variant_product" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_user" FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_club" FOREIGN KEY ("club_id") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_product" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_variant" FOREIGN KEY ("variant_id") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
