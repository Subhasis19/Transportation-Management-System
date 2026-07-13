import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, VehicleStatus } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for seeding");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const future = (years: number) => new Date(new Date().setFullYear(new Date().getFullYear() + years));

async function main() {
  const passwordHash = await bcrypt.hash("Demo@123", 12);
  await prisma.user.upsert({ where: { email: "admin@fleetflow.demo" }, update: {}, create: { name: "Aarav Admin", email: "admin@fleetflow.demo", phone: "+919000000001", passwordHash, role: Role.ADMIN } });
  await prisma.user.upsert({ where: { email: "driver@fleetflow.demo" }, update: {}, create: { name: "Dev Driver", email: "driver@fleetflow.demo", phone: "+919000000002", passwordHash, role: Role.DRIVER, licenseNumber: "DL-DEL-2026-1001", licenseExpiry: future(3) } });
  await prisma.user.upsert({ where: { email: "customer@fleetflow.demo" }, update: {}, create: { name: "Cora Customer", email: "customer@fleetflow.demo", phone: "+919000000003", passwordHash, role: Role.CUSTOMER } });
  for (const [vehicleType, baseFare, perKmRate] of [["MINI_TRUCK", 800, 14], ["LIGHT_TRUCK", 1200, 19], ["MEDIUM_TRUCK", 1800, 27], ["HEAVY_TRUCK", 2600, 38]] as const) await prisma.pricing.upsert({ where: { vehicleType }, update: { baseFare, perKmRate, gstPercent: 18 }, create: { vehicleType, baseFare, perKmRate, gstPercent: 18 } });
  const cities = await Promise.all(["Delhi", "Jaipur", "Mumbai", "Pune"].map((cityName) => prisma.location.upsert({ where: { cityName }, update: {}, create: { cityName } })));
  const byName = Object.fromEntries(cities.map((city) => [city.cityName, city]));
  for (const [from, to, distanceKm, tollAmount] of [["Delhi", "Jaipur", 281, 450], ["Mumbai", "Pune", 148, 280], ["Jaipur", "Delhi", 281, 450], ["Pune", "Mumbai", 148, 280]] as const) await prisma.route.upsert({ where: { fromLocationId_toLocationId: { fromLocationId: byName[from].id, toLocationId: byName[to].id } }, update: { distanceKm, tollAmount }, create: { fromLocationId: byName[from].id, toLocationId: byName[to].id, distanceKm, tollAmount } });
  await prisma.vehicle.upsert({ where: { regNumber: "DL01AB1234" }, update: {}, create: { regNumber: "DL01AB1234", vehicleType: "MINI_TRUCK", capacityKg: 1800, status: VehicleStatus.AVAILABLE, rcNumber: "RC-001", rcExpiry: future(2), permitNumber: "PERMIT-001", permitExpiry: future(2) } });
  await prisma.vehicle.upsert({ where: { regNumber: "MH12CD5678" }, update: {}, create: { regNumber: "MH12CD5678", vehicleType: "MEDIUM_TRUCK", capacityKg: 8500, status: VehicleStatus.AVAILABLE, rcNumber: "RC-002", rcExpiry: future(2), permitNumber: "PERMIT-002", permitExpiry: future(2) } });
  console.log("Seeded demo data. All demo passwords: Demo@123");
}
main().finally(() => prisma.$disconnect());
