import { AppError } from "../../common/errors/app-error";
import { BookingStatus, Prisma, Role, VehicleStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { createInvoice, createLorryReceipt } from "../../services/documents";
import { isVehicleCompliant } from "./booking.shared";
import { canAssignDriverToActiveTrip } from "./booking.rules";

const confirmationAttempts = 3;

export function confirmationCompensation(bookingId: string) {
    return {
        where: {
            id: bookingId,
            status: BookingStatus.CONFIRMED,
            lrPdfUrl: null,
        },
        data: {
            status: BookingStatus.PENDING,
            driverId: null,
            lrNumber: null,
            lrGeneratedAt: null,
            lrPdfUrl: null,
        },
    };
}

export function invoiceCompensation(bookingId: string) {
    return {
        where: {
            id: bookingId,
            status: BookingStatus.INVOICED,
            invoicePdfUrl: null,
        },
        data: {
            status: BookingStatus.IN_TRANSIT,
            invoiceNumber: null,
            invoiceGeneratedAt: null,
            invoicePdfUrl: null,
            deliveryNotes: null,
            deliveryTime: null,
        },
    };
}

function isTransactionConflict(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034"
    );
}

export async function retryConfirmationTransaction<T>(operation: () => Promise<T>) {
    for (let attempt = 1; attempt <= confirmationAttempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            if (!isTransactionConflict(error)) throw error;
            if (attempt === confirmationAttempts) {
                throw new AppError(409, "Booking confirmation conflict; please try again");
            }
        }
    }

    throw new AppError(409, "Booking confirmation conflict; please try again");
}

export async function confirmBooking(bookingId: string, driverId: string) {
    const booking = await retryConfirmationTransaction(() => prisma.$transaction(async (tx) => {
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

    const complete = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { vehicle: true },
    });

    try {
        const lrPdfUrl = await createLorryReceipt(complete, complete.vehicle.regNumber);
        return await prisma.booking.update({
            where: { id: booking.id },
            data: { lrPdfUrl },
        });
    } catch {
        await prisma.booking.updateMany(confirmationCompensation(booking.id));
        throw new AppError(500, "Unable to generate lorry receipt");
    }
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
    try {
        const invoicePdfUrl = await createInvoice(booking);
        return await prisma.booking.update({
            where: { id: bookingId },
            data: { invoicePdfUrl },
        });
    } catch {
        await prisma.booking.updateMany(invoiceCompensation(bookingId));
        throw new AppError(500, "Unable to generate invoice");
    }
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
