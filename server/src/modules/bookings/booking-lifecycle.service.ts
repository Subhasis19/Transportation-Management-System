import { AppError } from "../../common/errors/app-error";
import { BookingStatus, Role, VehicleStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { createInvoice, createLorryReceipt } from "../../services/documents";
import { isVehicleCompliant } from "./booking.shared";
import { canAssignDriverToActiveTrip } from "./booking.rules";

export async function confirmBooking(bookingId: string, driverId: string) {
    const booking = await prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { vehicle: true },
        });
        const driver = await tx.user.findUnique({ where: { id: driverId } });

        if (!current || current.status !== BookingStatus.PENDING) {
            throw new AppError(409, "Only pending bookings can be confirmed");
        }

        if (
            current.vehicle.status !== VehicleStatus.RESERVED ||
            !driver ||
            driver.role !== Role.DRIVER ||
            !driver.isActive ||
            !driver.licenseNumber ||
            !driver.licenseExpiry ||
            driver.licenseExpiry <= new Date() ||
            !isVehicleCompliant(current.vehicle)
        ) {
            throw new AppError(400, "Vehicle or assigned driver is not compliant");
        }

        const activeAssignments = await tx.booking.count({
            where: {
                driverId,
                status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_TRANSIT] },
            },
        });
        if (!canAssignDriverToActiveTrip(activeAssignments)) {
            throw new AppError(409, "Driver is already assigned to an active trip");
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.CONFIRMED,
                driverId,
                lrNumber: `LR-${current.id.slice(-8).toUpperCase()}`,
                lrGeneratedAt: new Date(),
            },
        });
    });

    const complete = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { vehicle: true },
    });

    let lrPdfUrl: string;
    try {
        lrPdfUrl = await createLorryReceipt(complete, complete.vehicle.regNumber);
    } catch {
        await prisma.booking.updateMany({
            where: {
                id: booking.id,
                status: BookingStatus.CONFIRMED,
                lrPdfUrl: null,
            },
            data: {
                status: BookingStatus.PENDING,
                driverId: null,
                lrNumber: null,
                lrGeneratedAt: null,
            },
        });
        throw new AppError(500, "Unable to generate lorry receipt");
    }

    return prisma.booking.update({
        where: { id: booking.id },
        data: { lrPdfUrl },
    });
}

export async function departBooking(bookingId: string) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { vehicle: true },
        });

        if (
            !current ||
            current.status !== BookingStatus.CONFIRMED ||
            !current.driverId ||
            current.vehicle.status !== VehicleStatus.RESERVED ||
            !isVehicleCompliant(current.vehicle) ||
            !current.lrPdfUrl
        ) {
            throw new AppError(409, "Only confirmed bookings can depart");
        }

        await tx.vehicle.update({
            where: { id: current.vehicleId },
            data: { status: VehicleStatus.ON_TRIP },
        });

        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.IN_TRANSIT },
        });
    });
}

export async function deliverBooking(bookingId: string, driverId: string, notes: string) {
    const current = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: true },
    });
    if (!current || current.driverId !== driverId || current.status !== BookingStatus.IN_TRANSIT || current.vehicle.status !== VehicleStatus.ON_TRIP) {
        throw new AppError(409, "This trip is not available for delivery");
    }

    const delivered = await prisma.booking.updateMany({
        where: {
            id: bookingId,
            driverId,
            status: BookingStatus.IN_TRANSIT,
        },
        data: {
            status: BookingStatus.INVOICED,
            deliveryNotes: notes,
            deliveryTime: new Date(),
            invoiceNumber: `INV-${bookingId.slice(-8).toUpperCase()}`,
            invoiceGeneratedAt: new Date(),
        },
    });

    if (delivered.count !== 1) {
        throw new AppError(409, "This trip is not available for delivery");
    }

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    let invoicePdfUrl: string;
    try {
        invoicePdfUrl = await createInvoice(booking);
    } catch {
        await prisma.booking.updateMany({
            where: {
                id: bookingId,
                status: BookingStatus.INVOICED,
                invoicePdfUrl: null,
            },
            data: {
                status: BookingStatus.IN_TRANSIT,
                invoiceNumber: null,
                invoiceGeneratedAt: null,
            },
        });
        throw new AppError(500, "Unable to generate invoice");
    }

    return prisma.booking.update({
        where: { id: bookingId },
        data: { invoicePdfUrl },
    });
}

export async function closeBooking(bookingId: string) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { vehicle: true },
        });

        if (
            !current ||
            current.status !== BookingStatus.INVOICED ||
            !current.invoicePdfUrl ||
            current.vehicle.status !== VehicleStatus.ON_TRIP
        ) {
            throw new AppError(409, "Only invoiced trips can be closed");
        }

        await tx.vehicle.update({
            where: { id: current.vehicleId },
            data: { status: VehicleStatus.AVAILABLE },
        });

        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CLOSED },
        });
    });
}

export async function cancelBooking(bookingId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { vehicle: true },
        });

        if (
            !current ||
            !([BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]).includes(current.status) ||
            current.vehicle.status !== VehicleStatus.RESERVED
        ) {
            throw new AppError(409, "Only pending or confirmed bookings can be cancelled");
        }

        await tx.vehicle.update({
            where: { id: current.vehicleId },
            data: { status: VehicleStatus.AVAILABLE },
        });

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.CANCELLED,
                cancellationReason: reason,
                cancelledAt: new Date(),
            },
        });
    });
}
