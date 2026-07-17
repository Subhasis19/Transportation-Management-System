import type { Prisma } from "../../generated/prisma/client";

export function buildUsableRouteWhere(
  fromLocationId: string,
  toLocationId: string,
): Prisma.RouteWhereInput {
  return {
    fromLocationId,
    toLocationId,
    fromLocation: { isActive: true },
    toLocation: { isActive: true },
  };
}

export function toPublicQuoteRoute(
  route: {
    id: string;
    fromLocationId: string;
    toLocationId: string;
    distanceKm: unknown;
    tollAmount: unknown;
  },
) {
  return {
    id: route.id,
    fromLocationId: route.fromLocationId,
    toLocationId: route.toLocationId,
    distanceKm: Number(route.distanceKm),
    tollAmount: Number(route.tollAmount),
  };
}
