import { AppError } from "../../common/errors/app-error";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { AdminLocationQuery, CreateLocationInput, UpdateLocationInput, UpdateLocationStatusInput } from "./location.schema";

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

export async function getActiveLocations() {
  return prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, cityName: true },
    orderBy: { cityName: "asc" },
  });
}

export async function getAdminLocations(query: AdminLocationQuery) {
  const where = {
    ...(query.search ? { cityName: { contains: query.search, mode: "insensitive" as const } } : {}),
    ...(query.status === "all" ? {} : { isActive: query.status === "active" }),
  };
  const items = await prisma.location.findMany({ where, select: adminLocationSelect, orderBy: { cityName: "asc" } });
  return { items, total: items.length };
}

async function ensureNoDuplicate(cityName: string, exceptId?: string) {
  const existing = await prisma.location.findFirst({
    where: {
      cityName: { equals: cityName, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new AppError(409, "Location already exists");
}

export async function createLocation(input: CreateLocationInput) {
  await ensureNoDuplicate(input.cityName);
  try {
    return await prisma.location.create({ data: { cityName: input.cityName }, select: adminLocationSelect });
  } catch (error) {
    if (isUniqueConflict(error)) throw new AppError(409, "Location already exists");
    throw error;
  }
}

export async function updateLocation(locationId: string, input: UpdateLocationInput) {
  const current = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!current) throw new AppError(404, "Location not found");
  await ensureNoDuplicate(input.cityName, locationId);
  try {
    return await prisma.location.update({ where: { id: locationId }, data: { cityName: input.cityName }, select: adminLocationSelect });
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
