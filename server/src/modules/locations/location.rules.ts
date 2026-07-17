export function normalizeLocationName(cityName: string): string {
  return cityName.trim().replace(/\s+/g, " ");
}

export function areLocationNamesEquivalent(a: string, b: string): boolean {
  return normalizeLocationName(a).toLocaleLowerCase() === normalizeLocationName(b).toLocaleLowerCase();
}

export function buildAdminLocationWhere(query: AdminLocationQuery): Prisma.LocationWhereInput {
  return {
    ...(query.search ? { cityName: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.status === "all" ? {} : { isActive: query.status === "active" }),
  };
}
import type { Prisma } from "../../generated/prisma/client";
import type { AdminLocationQuery } from "./location.schema";
