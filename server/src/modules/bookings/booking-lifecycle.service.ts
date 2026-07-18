import { AppError } from "../../common/errors/app-error";
import {
  BookingStatus,
  Prisma,
  Role,
  VehicleStatus,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { createInvoice, createLorryReceipt } from "../../services/documents";
import { isVehicleCompliant } from "./booking.shared";
import { canAssignDriverToActiveTrip } from "./booking.rules";

const lifecycleAttempts = 3;
const lifecycleConflictMessage = "Booking lifecycle conflict; please try again";

export function confirmationCompensation(bookingId: string) {
  return {
    where: { id: bookingId, status: BookingStatus.CONFIRMED, lrPdfUrl: null },
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
export async function retryLifecycleTransaction<T>(
  operation: () => Promise<T>,
  message = lifecycleConflictMessage,
) {
  for (let attempt = 1; attempt <= lifecycleAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt === lifecycleAttempts) throw new AppError(409, message);
    }
  }
  throw new AppError(409, message);
}
export async function retryConfirmationTransaction<T>(
  operation: () => Promise<T>,
) {
  return retryLifecycleTransaction(
    operation,
    "Booking confirmation conflict; please try again",
  );
}

export async function confirmBooking(bookingId: string, driverId: string) {
  const booking = await retryConfirmationTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { vehicle: true },
        });
        const driver = await tx.user.findUnique({ where: { id: driverId } });
        if (!current || current.status !== BookingStatus.PENDING)
          throw new AppError(409, "Only pending bookings can be confirmed");
        if (
          current.vehicle.status !== VehicleStatus.RESERVED ||
          !driver ||
          driver.role !== Role.DRIVER ||
          !driver.isActive ||
          !driver.licenseNumber ||
          !driver.licenseExpiry ||
          driver.licenseExpiry <= new Date() ||
          !isVehicleCompliant(current.vehicle)
        )
          throw new AppError(
            400,
            "Vehicle or assigned driver is not compliant",
          );
        const assignments = await tx.booking.count({
          where: {
            driverId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_TRANSIT] },
          },
        });
        if (!canAssignDriverToActiveTrip(assignments))
          throw new AppError(
            409,
            "Driver is already assigned to an active trip",
          );
        const updated = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: BookingStatus.PENDING,
            driverId: null,
          },
          data: {
            status: BookingStatus.CONFIRMED,
            driverId,
            lrNumber: `LR-${current.id.slice(-8).toUpperCase()}`,
            lrGeneratedAt: new Date(),
          },
        });
        if (updated.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        return current;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  try {
    const complete = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { vehicle: true },
    });
    const lrPdfUrl = await createLorryReceipt(
      complete,
      complete.vehicle.regNumber,
    );
    const finalized = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: BookingStatus.CONFIRMED,
        lrPdfUrl: null,
      },
      data: { lrPdfUrl },
    });
    if (finalized.count !== 1)
      throw new AppError(409, lifecycleConflictMessage);
    return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  } catch (error) {
    if (error instanceof AppError) throw error;
    await prisma.booking.updateMany(confirmationCompensation(booking.id));
    throw new AppError(500, "Unable to generate lorry receipt");
  }
}

export async function departBooking(bookingId: string) {
  return retryLifecycleTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { vehicle: true },
        });
        if (
          !current ||
          current.status !== BookingStatus.CONFIRMED ||
          !current.driverId ||
          !current.lrPdfUrl ||
          current.vehicle.status !== VehicleStatus.RESERVED ||
          !isVehicleCompliant(current.vehicle)
        )
          throw new AppError(409, "Only confirmed bookings can depart");
        const vehicle = await tx.vehicle.updateMany({
          where: { id: current.vehicleId, status: VehicleStatus.RESERVED },
          data: { status: VehicleStatus.ON_TRIP },
        });
        if (vehicle.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        const booking = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: BookingStatus.CONFIRMED,
            driverId: current.driverId,
            lrPdfUrl: { not: null },
          },
          data: { status: BookingStatus.IN_TRANSIT },
        });
        if (booking.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function deliverBooking(
  bookingId: string,
  driverId: string,
  notes: string,
) {
  const delivered = await retryLifecycleTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { vehicle: true },
        });
        if (
          !current ||
          current.driverId !== driverId ||
          current.status !== BookingStatus.IN_TRANSIT ||
          current.vehicle.status !== VehicleStatus.ON_TRIP
        )
          throw new AppError(409, "This trip is not available for delivery");
        const updated = await tx.booking.updateMany({
          where: { id: bookingId, driverId, status: BookingStatus.IN_TRANSIT },
          data: {
            status: BookingStatus.INVOICED,
            deliveryNotes: notes,
            deliveryTime: new Date(),
            invoiceNumber: `INV-${bookingId.slice(-8).toUpperCase()}`,
            invoiceGeneratedAt: new Date(),
          },
        });
        if (updated.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  try {
    const invoicePdfUrl = await createInvoice(delivered);
    const finalized = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.INVOICED,
        invoicePdfUrl: null,
      },
      data: { invoicePdfUrl },
    });
    if (finalized.count !== 1)
      throw new AppError(409, lifecycleConflictMessage);
    return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  } catch (error) {
    if (error instanceof AppError) throw error;
    await prisma.booking.updateMany(invoiceCompensation(bookingId));
    throw new AppError(500, "Unable to generate invoice");
  }
}

export async function closeBooking(bookingId: string) {
  return retryLifecycleTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { vehicle: true },
        });
        if (
          !current ||
          current.status !== BookingStatus.INVOICED ||
          !current.invoicePdfUrl ||
          current.vehicle.status !== VehicleStatus.ON_TRIP
        )
          throw new AppError(409, "Only invoiced trips can be closed");
        const vehicle = await tx.vehicle.updateMany({
          where: { id: current.vehicleId, status: VehicleStatus.ON_TRIP },
          data: { status: VehicleStatus.AVAILABLE },
        });
        if (vehicle.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        const booking = await tx.booking.updateMany({
          where: {
            id: bookingId,
            status: BookingStatus.INVOICED,
            invoicePdfUrl: { not: null },
          },
          data: { status: BookingStatus.CLOSED },
        });
        if (booking.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function cancelBooking(bookingId: string, reason: string) {
  return retryLifecycleTransaction(() =>
    prisma.$transaction(
      async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { vehicle: true },
        });
        if (
          !current ||
          !(
            [BookingStatus.PENDING, BookingStatus.CONFIRMED] as BookingStatus[]
          ).includes(current.status) ||
          current.vehicle.status !== VehicleStatus.RESERVED
        )
          throw new AppError(
            409,
            "Only pending or confirmed bookings can be cancelled",
          );
        const vehicle = await tx.vehicle.updateMany({
          where: { id: current.vehicleId, status: VehicleStatus.RESERVED },
          data: { status: VehicleStatus.AVAILABLE },
        });
        if (vehicle.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        const booking = await tx.booking.updateMany({
          where: { id: bookingId, status: current.status },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: reason,
            cancelledAt: new Date(),
          },
        });
        if (booking.count !== 1)
          throw new AppError(409, lifecycleConflictMessage);
        return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
