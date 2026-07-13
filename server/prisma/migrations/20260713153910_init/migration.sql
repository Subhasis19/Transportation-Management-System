-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CUSTOMER', 'DRIVER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_TRIP', 'BREAKDOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "license_number" VARCHAR(50),
    "license_expiry" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "reg_number" VARCHAR(20) NOT NULL,
    "vehicle_type" VARCHAR(50) NOT NULL,
    "capacity_kg" DECIMAL(10,2) NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rc_number" VARCHAR(50) NOT NULL,
    "rc_expiry" DATE NOT NULL,
    "permit_number" VARCHAR(50) NOT NULL,
    "permit_expiry" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "city_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "distance_km" DECIMAL(8,2) NOT NULL,
    "toll_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing" (
    "id" TEXT NOT NULL,
    "vehicle_type" VARCHAR(50) NOT NULL,
    "base_fare" DECIMAL(10,2) NOT NULL,
    "per_km_rate" DECIMAL(10,2) NOT NULL,
    "gst_percent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "via_route" VARCHAR(255),
    "consignor_name" VARCHAR(150) NOT NULL,
    "consignee_name" VARCHAR(150) NOT NULL,
    "material_description" VARCHAR(255) NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "declared_value" DECIMAL(12,2) NOT NULL,
    "distance_km" DECIMAL(8,2) NOT NULL,
    "estimated_fare" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "lr_number" VARCHAR(30),
    "lr_pdf_url" VARCHAR(500),
    "lr_generated_at" TIMESTAMP(3),
    "delivery_time" TIMESTAMP(3),
    "delivery_notes" TEXT,
    "invoice_number" VARCHAR(30),
    "invoice_base_fare" DECIMAL(10,2),
    "invoice_toll_amount" DECIMAL(10,2),
    "invoice_gst_amount" DECIMAL(10,2),
    "invoice_total_amount" DECIMAL(12,2),
    "invoice_pdf_url" VARCHAR(500),
    "invoice_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_license_expiry_idx" ON "users"("license_expiry");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_reg_number_key" ON "vehicles"("reg_number");

-- CreateIndex
CREATE INDEX "vehicles_rc_expiry_idx" ON "vehicles"("rc_expiry");

-- CreateIndex
CREATE INDEX "vehicles_permit_expiry_idx" ON "vehicles"("permit_expiry");

-- CreateIndex
CREATE UNIQUE INDEX "locations_city_name_key" ON "locations"("city_name");

-- CreateIndex
CREATE UNIQUE INDEX "routes_from_location_id_to_location_id_key" ON "routes"("from_location_id", "to_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_vehicle_type_key" ON "pricing"("vehicle_type");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_lr_number_key" ON "bookings"("lr_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_invoice_number_key" ON "bookings"("invoice_number");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_driver_id_idx" ON "bookings"("driver_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
