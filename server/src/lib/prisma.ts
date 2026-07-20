import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const databasePoolConfig = {
  max: 3,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 300_000,
} as const satisfies Pick<
  PoolConfig,
  "max" | "connectionTimeoutMillis" | "idleTimeoutMillis"
>;

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ...databasePoolConfig,
  }),
});
