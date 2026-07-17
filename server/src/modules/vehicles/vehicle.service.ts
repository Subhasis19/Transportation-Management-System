import { AppError } from "../../common/errors/app-error";
import { BookingStatus, Prisma, VehicleStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type {
    AdminVehicleQuery,
    CreateVehicleInput,
    UpdateVehicleInput,
    UpdateVehicleStatusInput,
} from "./vehicle.schema";
import {
    activeVehicleBookingStatuses,
    getDocumentStatusWhere,
    getVehicleDocumentStatus,
} from "./vehicle.rules";

const activeBookingStatusFilter: BookingStatus[] = [
    ...activeVehicleBookingStatuses,
];

const adminVehicleSelect = {
    id: true,
    regNumber: true,
    vehicleType: true,
    capacityKg: true,
    status: true,
    rcNumber: true,
    rcExpiry: true,
    permitNumber: true,
    permitExpiry: true,
    createdAt: true,
    updatedAt: true,
    bookings: {
        where: { status: { in: activeBookingStatusFilter } },
        take: 1,
        select: { id: true, status: true },
    },
} as const satisfies Prisma.VehicleSelect;

type AdminVehicleRecord = Prisma.VehicleGetPayload<{
    select: typeof adminVehicleSelect;
}>;

function toAdminVehicle(vehicle: AdminVehicleRecord, now = new Date()) {
    const activeBooking = vehicle.bookings[0] ?? null;
    return {
        id: vehicle.id,
        regNumber: vehicle.regNumber,
        vehicleType: vehicle.vehicleType,
        capacityKg: Number(vehicle.capacityKg),
        status: vehicle.status,
        rcNumber: vehicle.rcNumber,
        rcExpiry: vehicle.rcExpiry,
        permitNumber: vehicle.permitNumber,
        permitExpiry: vehicle.permitExpiry,
        documentStatus: getVehicleDocumentStatus(
            vehicle.rcExpiry,
            vehicle.permitExpiry,
            now,
        ),
        activeBooking: activeBooking
            ? { id: activeBooking.id, status: activeBooking.status }
            : null,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
    };
}

function isDocumentValid(rcExpiry: Date, permitExpiry: Date, now = new Date()) {
    return rcExpiry > now && permitExpiry > now;
}

async function ensureRateCard(
    tx: Prisma.TransactionClient | typeof prisma,
    vehicleType: string,
) {
    const rateCard = await tx.pricing.findUnique({
        where: { vehicleType },
        select: { id: true },
    });
    if (!rateCard) {
        throw new AppError(
            409,
            "Rate card is not configured for this vehicle type",
        );
    }
}

function mapVehicleError(error: unknown) {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    ) {
        return new AppError(409, "Vehicle registration number already exists");
    }
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    ) {
        return new AppError(404, "Vehicle not found");
    }
    return error;
}

export async function getVehicles(query: AdminVehicleQuery) {
    const now = new Date();
    const conditions: Prisma.VehicleWhereInput[] = [
        getDocumentStatusWhere(query.documentStatus, now),
    ];

    if (query.search) {
        conditions.push({
            OR: [
                { regNumber: { contains: query.search, mode: "insensitive" } },
                { rcNumber: { contains: query.search, mode: "insensitive" } },
                { permitNumber: { contains: query.search, mode: "insensitive" } },
            ],
        });
    }
    if (query.status !== "all") conditions.push({ status: query.status });
    if (query.vehicleType !== "all") {
        conditions.push({ vehicleType: query.vehicleType });
    }
    const where: Prisma.VehicleWhereInput = { AND: conditions };

    const [total, vehicles] = await Promise.all([
        prisma.vehicle.count({ where }),
        prisma.vehicle.findMany({
            where,
            select: adminVehicleSelect,
            orderBy: { regNumber: "asc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
    ]);

    return {
        items: vehicles.map((vehicle) => toAdminVehicle(vehicle, now)),
        total,
        page: query.page,
        limit: query.limit,
    };
}

export async function createVehicle(input: CreateVehicleInput) {
    const now = new Date();
    if (!isDocumentValid(input.rcExpiry, input.permitExpiry, now)) {
        throw new AppError(409, "New vehicles must have valid RC and permit documents");
    }
    try {
        await ensureRateCard(prisma, input.vehicleType);
        const vehicle = await prisma.vehicle.create({
            data: input,
            select: adminVehicleSelect,
        });
        return toAdminVehicle(vehicle, now);
    } catch (error) {
        throw mapVehicleError(error);
    }
}

export async function updateVehicle(vehicleId: string, input: UpdateVehicleInput) {
    try {
        return await prisma.$transaction(async (tx) => {
            const current = await tx.vehicle.findUnique({
                where: { id: vehicleId },
                select: adminVehicleSelect,
            });
            if (!current) throw new AppError(404, "Vehicle not found");
            if (current.bookings[0]) {
                throw new AppError(
                    409,
                    "Vehicle details cannot be changed during an active booking",
                );
            }

            const vehicleType = input.vehicleType ?? current.vehicleType;
            const rcExpiry = input.rcExpiry ?? current.rcExpiry;
            const permitExpiry = input.permitExpiry ?? current.permitExpiry;
            if (input.vehicleType && input.vehicleType !== current.vehicleType) {
                await ensureRateCard(tx, vehicleType);
            }
            if (
                current.status === VehicleStatus.AVAILABLE &&
                !isDocumentValid(rcExpiry, permitExpiry)
            ) {
                throw new AppError(
                    409,
                    "Available vehicles must have valid RC and permit documents",
                );
            }

            const vehicle = await tx.vehicle.update({
                where: { id: vehicleId },
                data: input,
                select: adminVehicleSelect,
            });
            return toAdminVehicle(vehicle);
        });
    } catch (error) {
        throw mapVehicleError(error);
    }
}

export async function updateVehicleStatus(
    vehicleId: string,
    input: UpdateVehicleStatusInput,
) {
    try {
        return await prisma.$transaction(async (tx) => {
            const current = await tx.vehicle.findUnique({
                where: { id: vehicleId },
                select: adminVehicleSelect,
            });
            if (!current) throw new AppError(404, "Vehicle not found");
            if (current.status === input.status) return toAdminVehicle(current);
            if (current.bookings[0]) {
                throw new AppError(
                    409,
                    "Vehicle status cannot be changed during an active booking",
                );
            }
            if (
                input.status === VehicleStatus.AVAILABLE &&
                !isDocumentValid(current.rcExpiry, current.permitExpiry)
            ) {
                throw new AppError(
                    409,
                    "Vehicle cannot be made available with expired documents",
                );
            }

            const vehicle = await tx.vehicle.update({
                where: { id: vehicleId },
                data: { status: input.status },
                select: adminVehicleSelect,
            });
            return toAdminVehicle(vehicle);
        });
    } catch (error) {
        throw mapVehicleError(error);
    }
}
