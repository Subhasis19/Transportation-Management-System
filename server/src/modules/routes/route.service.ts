import { AppError } from "../../common/errors/app-error";
import { VehicleStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { calculateFare } from "../../services/fare";
import { buildUsableRouteWhere, toPublicQuoteRoute } from "./route.rules";
import type { CreateRouteInput, QuoteQueryInput } from "./route.schema";

export async function getQuote(input: QuoteQueryInput) {
    if (input.fromLocationId === input.toLocationId) {
        throw new AppError(400, "Origin and destination must differ");
    }

    const route = await prisma.route.findFirst({
        where: buildUsableRouteWhere(input.fromLocationId, input.toLocationId),
    });

    if (!route) {
        throw new AppError(404, "This route is not configured yet");
    }

    const vehicles = await prisma.vehicle.findMany({
        where: {
            status: VehicleStatus.AVAILABLE,
            rcExpiry: { gt: new Date() },
            permitExpiry: { gt: new Date() },
        },
        include: { rateCard: true },
        orderBy: { capacityKg: "asc" },
    });

    return {
        route: toPublicQuoteRoute(route),
        options: vehicles.map((vehicle) => ({
            vehicle: {
                id: vehicle.id,
                regNumber: vehicle.regNumber,
                vehicleType: vehicle.vehicleType,
                capacityKg: Number(vehicle.capacityKg),
            },
            fare: calculateFare({
                distanceKm: Number(route.distanceKm),
                tollAmount: Number(route.tollAmount),
                baseFare: Number(vehicle.rateCard.baseFare),
                perKmRate: Number(vehicle.rateCard.perKmRate),
                gstPercent: Number(vehicle.rateCard.gstPercent),
            }),
        })),
    };
}

export async function getAdminRoutes() {
    return prisma.route.findMany({
        include: { fromLocation: true, toLocation: true },
        orderBy: { fromLocation: { cityName: "asc" } },
    });
}

export async function upsertRoute(input: CreateRouteInput) {
    if (input.fromLocationId === input.toLocationId) {
        throw new AppError(400, "Origin and destination must differ");
    }

    return prisma.route.upsert({
        where: {
            fromLocationId_toLocationId: {
                fromLocationId: input.fromLocationId,
                toLocationId: input.toLocationId,
            },
        },
        update: {
            distanceKm: input.distanceKm,
            tollAmount: input.tollAmount,
        },
        create: input,
    });
}
