import { AppError } from "../../common/errors/app-error.js";
import { Prisma, VehicleStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { calculateFare } from "../../services/fare.js";
import {
    buildAdminRouteWhere,
    buildUsableRouteWhere,
    toPublicQuoteRoute,
} from "./route.rules.js";
import type {
    AdminRouteQuery,
    CreateRouteInput,
    QuoteQueryInput,
    UpdateRouteInput,
    UpdateRouteStatusInput,
} from "./route.schema.js";

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

const adminRouteSelect = {
    id: true,
    fromLocationId: true,
    toLocationId: true,
    distanceKm: true,
    tollAmount: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    fromLocation: { select: { id: true, cityName: true, isActive: true } },
    toLocation: { select: { id: true, cityName: true, isActive: true } },
} as const;
function toAdminRoute(
    route: Prisma.RouteGetPayload<{ select: typeof adminRouteSelect }>,
) {
    return {
        ...route,
        distanceKm: Number(route.distanceKm),
        tollAmount: Number(route.tollAmount),
    };
}
function mapError(error: unknown) {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    )
        return new AppError(409, "Route already exists");
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    )
        return new AppError(404, "Route not found");
    return error;
}
async function validateLocations(
    tx: Prisma.TransactionClient | typeof prisma,
    fromLocationId: string,
    toLocationId: string,
) {
    if (fromLocationId === toLocationId)
        throw new AppError(400, "Origin and destination must differ");
    const locations = await tx.location.findMany({
        where: { id: { in: [fromLocationId, toLocationId] } },
        select: { id: true, isActive: true },
    });
    if (locations.length !== 2) throw new AppError(404, "Location not found");
    if (locations.some((location) => !location.isActive))
        throw new AppError(409, "Both route locations must be active");
}
export async function getAdminRoutes(query: AdminRouteQuery) {
    const items = await prisma.route.findMany({
        where: buildAdminRouteWhere(query),
        select: adminRouteSelect,
        orderBy: [
            { fromLocation: { cityName: "asc" } },
            { toLocation: { cityName: "asc" } },
        ],
    });
    return { items: items.map(toAdminRoute), total: items.length };
}

export async function createRoute(input: CreateRouteInput) {
    if (input.fromLocationId === input.toLocationId) {
        throw new AppError(400, "Origin and destination must differ");
    }

    try {
        return await prisma.$transaction(async (tx) => {
            await validateLocations(tx, input.fromLocationId, input.toLocationId);
            const duplicate = await tx.route.findUnique({
                where: {
                    fromLocationId_toLocationId: {
                        fromLocationId: input.fromLocationId,
                        toLocationId: input.toLocationId,
                    },
                },
            });
            if (duplicate) throw new AppError(409, "Route already exists");
            return toAdminRoute(
                await tx.route.create({ data: input, select: adminRouteSelect }),
            );
        });
    } catch (error) {
        throw mapError(error);
    }
}
export async function updateRoute(routeId: string, input: UpdateRouteInput) {
    try {
        return await prisma.$transaction(async (tx) => {
            const current = await tx.route.findUnique({ where: { id: routeId } });
            if (!current) throw new AppError(404, "Route not found");
            const fromLocationId = input.fromLocationId ?? current.fromLocationId;
            const toLocationId = input.toLocationId ?? current.toLocationId;
            if (
                fromLocationId !== current.fromLocationId ||
                toLocationId !== current.toLocationId
            )
                await validateLocations(tx, fromLocationId, toLocationId);
            if (fromLocationId === toLocationId)
                throw new AppError(400, "Origin and destination must differ");
            const duplicate = await tx.route.findFirst({
                where: { fromLocationId, toLocationId, id: { not: routeId } },
            });
            if (duplicate) throw new AppError(409, "Route already exists");
            return toAdminRoute(
                await tx.route.update({
                    where: { id: routeId },
                    data: { ...input, fromLocationId, toLocationId },
                    select: adminRouteSelect,
                }),
            );
        });
    } catch (error) {
        throw mapError(error);
    }
}
export async function updateRouteStatus(
    routeId: string,
    input: UpdateRouteStatusInput,
) {
    try {
        return await prisma.$transaction(async (tx) => {
            const current = await tx.route.findUnique({
                where: { id: routeId },
                select: adminRouteSelect,
            });
            if (!current) throw new AppError(404, "Route not found");
            if (current.isActive === input.isActive) return toAdminRoute(current);
            if (input.isActive)
                await validateLocations(
                    tx,
                    current.fromLocationId,
                    current.toLocationId,
                );
            return toAdminRoute(
                await tx.route.update({
                    where: { id: routeId },
                    data: { isActive: input.isActive },
                    select: adminRouteSelect,
                }),
            );
        });
    } catch (error) {
        throw mapError(error);
    }
}
