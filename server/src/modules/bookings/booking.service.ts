import { AppError } from "../../common/errors/app-error";
import { Role, VehicleStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { signedDocumentUrl } from "../../lib/storage";
import { calculateFare } from "../../services/fare";
import type { CreateBookingInput } from "./booking.schema";
import { bookingInclude, isVehicleCompliant } from "./booking.shared";
import { isWeightWithinVehicleCapacity } from "./booking.rules";
import { buildUsableRouteWhere } from "../routes/route.rules";

export async function createBooking(customerId: string, input: CreateBookingInput) {
    return prisma.$transaction(async (tx) => {
        const route = await tx.route.findFirst({
            where: buildUsableRouteWhere(input.fromLocationId, input.toLocationId),
        });

        if (!route) {
            throw new AppError(400, "This route is not configured yet");
        }

        const vehicle = await tx.vehicle.findUnique({
            where: { id: input.vehicleId },
            include: { rateCard: true },
        });

        if (!vehicle || vehicle.status !== VehicleStatus.AVAILABLE || !isVehicleCompliant(vehicle)) {
            throw new AppError(409, "This vehicle is no longer available or compliant");
        }

        if (!isWeightWithinVehicleCapacity(Number(input.weightKg), Number(vehicle.capacityKg))) {
            throw new AppError(409, "Cargo weight exceeds vehicle capacity");
        }

        const reserved = await tx.vehicle.updateMany({
            where: { id: vehicle.id, status: VehicleStatus.AVAILABLE },
            data: { status: VehicleStatus.RESERVED },
        });

        if (reserved.count !== 1) {
            throw new AppError(409, "This vehicle was just reserved by another booking");
        }

        const fare = calculateFare({
            distanceKm: Number(route.distanceKm),
            tollAmount: Number(route.tollAmount),
            baseFare: Number(vehicle.rateCard.baseFare),
            perKmRate: Number(vehicle.rateCard.perKmRate),
            gstPercent: Number(vehicle.rateCard.gstPercent),
        });

        return tx.booking.create({
            data: {
                ...input,
                customerId,
                distanceKm: fare.distanceKm,
                baseFare: fare.baseFare,
                distanceCharge: fare.distanceCharge,
                tollAmount: fare.tollAmount,
                gstPercent: fare.gstPercent,
                gstAmount: fare.gstAmount,
                estimatedFare: fare.total,
            },
            include: bookingInclude,
        });
    });
}

export async function getBookingsForUser(userId: string, role: Role) {
    const where =
        role === Role.CUSTOMER
            ? { customerId: userId }
            : role === Role.DRIVER
                ? { driverId: userId }
                : {};

    return prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
    });
}

export async function getBookingDocumentUrl(bookingId: string, kind: string, userId: string, role: Role) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
    });

    if (!booking || (![booking.customerId, booking.driverId].includes(userId) && role !== Role.ADMIN)) {
        throw new AppError(404, "Document not found");
    }

    const path = kind === "lr" ? booking.lrPdfUrl : kind === "invoice" ? booking.invoicePdfUrl : null;

    if (!path) {
        throw new AppError(404, "Document is not available");
    }

    return { url: await signedDocumentUrl(path) };
}
