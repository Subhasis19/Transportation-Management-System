/*
  Warnings:

  - You are about to drop the column `invoice_base_fare` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_gst_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_toll_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_total_amount` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `base_fare` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `distance_charge` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gst_amount` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gst_percent` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pickup_at` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toll_amount` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "VehicleStatus" ADD VALUE 'RESERVED';

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "invoice_base_fare",
DROP COLUMN "invoice_gst_amount",
DROP COLUMN "invoice_toll_amount",
DROP COLUMN "invoice_total_amount",
ADD COLUMN     "base_fare" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "distance_charge" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "gst_amount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "gst_percent" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "pickup_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "toll_amount" DECIMAL(10,2) NOT NULL,
ALTER COLUMN "estimated_fare" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_fkey" FOREIGN KEY ("vehicle_type") REFERENCES "pricing"("vehicle_type") ON DELETE RESTRICT ON UPDATE CASCADE;
