import type { Prisma } from "../../generated/prisma/client";

export function buildUsableRouteWhere(
  fromLocationId: string,
  toLocationId: string,
): Prisma.RouteWhereInput {
  return {
    fromLocationId,
    toLocationId,
    isActive: true,
    fromLocation: { isActive: true },
    toLocation: { isActive: true },
  };
}

export function buildAdminRouteWhere(query: {
  search: string;
  status: "all" | "active" | "inactive";
}): Prisma.RouteWhereInput {
  return {
    ...(query.search
      ? {
          OR: [
            {
              fromLocation: {
                cityName: { contains: query.search, mode: "insensitive" },
              },
            },
            {
              toLocation: {
                cityName: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
    ...(query.status === "all" ? {} : { isActive: query.status === "active" }),
  };
}

export function toPublicQuoteRoute(route: {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  distanceKm: unknown;
  tollAmount: unknown;
}) {
  return {
    id: route.id,
    fromLocationId: route.fromLocationId,
    toLocationId: route.toLocationId,
    distanceKm: Number(route.distanceKm),
    tollAmount: Number(route.tollAmount),
  };
}
