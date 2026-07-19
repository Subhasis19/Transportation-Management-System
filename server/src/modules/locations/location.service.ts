import { AppError } from "../../common/errors/app-error.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { AdminLocationQuery, CreateLocationInput, UpdateLocationInput, UpdateLocationStatusInput } from "./location.schema.js";
import { buildAdminLocationWhere } from "./location.rules.js";

const adminLocationSelect = {
  id: true,
  cityName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt === 3) throw new AppError(409, "Location already exists");
    }
  }
  throw new AppError(409, "Location already exists");
}

export async function getActiveLocations() {
  return prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, cityName: true },
    orderBy: { cityName: "asc" },
  });
}

export async function getAdminLocations(query: AdminLocationQuery) {
  const items = await prisma.location.findMany({ where: buildAdminLocationWhere(query), select: adminLocationSelect, orderBy: { cityName: "asc" } });
  return { items, total: items.length };
}

export async function createLocation(input: CreateLocationInput) {
  try {
    return await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      const existing = await tx.location.findFirst({ where: { cityName: { equals: input.cityName, mode: "insensitive" } }, select: { id: true } });
      if (existing) throw new AppError(409, "Location already exists");
      return tx.location.create({ data: { cityName: input.cityName }, select: adminLocationSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError(409, "Location already exists");
    throw error;
  }
}

export async function updateLocation(locationId: string, input: UpdateLocationInput) {
  try {
    return await withSerializableRetry(() => prisma.$transaction(async (tx) => {
      const current = await tx.location.findUnique({ where: { id: locationId }, select: { id: true } });
      if (!current) throw new AppError(404, "Location not found");
      const existing = await tx.location.findFirst({
        where: { cityName: { equals: input.cityName, mode: "insensitive" }, id: { not: locationId } },
        select: { id: true },
      });
      if (existing) throw new AppError(409, "Location already exists");
      return tx.location.update({ where: { id: locationId }, data: { cityName: input.cityName }, select: adminLocationSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError(409, "Location already exists");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(404, "Location not found");
    }
    throw error;
  }
}

export async function updateLocationStatus(locationId: string, input: UpdateLocationStatusInput) {
  try {
    return await prisma.location.update({ where: { id: locationId }, data: { isActive: input.isActive }, select: adminLocationSelect });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(404, "Location not found");
    }
    throw error;
  }
}
