import { AppError } from "../../common/errors/app-error";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { AdminBookingQuery } from "./booking.schema";

const adminBookingListSelect = {
  id: true, status: true, pickupAt: true, materialDescription: true, weightKg: true,
  estimatedFare: true, lrNumber: true, invoiceNumber: true, lrPdfUrl: true,
  invoicePdfUrl: true, createdAt: true, updatedAt: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
  driver: { select: { id: true, name: true } },
  vehicle: { select: { id: true, regNumber: true, vehicleType: true, status: true } },
  fromLocation: { select: { id: true, cityName: true } },
  toLocation: { select: { id: true, cityName: true } },
} as const satisfies Prisma.BookingSelect;

const adminBookingDetailSelect = {
  ...adminBookingListSelect,
  viaRoute: true, consignorName: true, consigneeName: true, declaredValue: true,
  distanceKm: true, baseFare: true, distanceCharge: true, tollAmount: true,
  gstPercent: true, gstAmount: true, cancellationReason: true, cancelledAt: true,
  lrGeneratedAt: true, deliveryTime: true, deliveryNotes: true, invoiceGeneratedAt: true,
  customer: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
  driver: { select: { id: true, name: true, email: true, phone: true, licenseNumber: true, licenseExpiry: true, isActive: true } },
  vehicle: { select: { id: true, regNumber: true, vehicleType: true, capacityKg: true, status: true, rcExpiry: true, permitExpiry: true } },
} as const satisfies Prisma.BookingSelect;

type ListRecord = Prisma.BookingGetPayload<{ select: typeof adminBookingListSelect }>;
type DetailRecord = Prisma.BookingGetPayload<{ select: typeof adminBookingDetailSelect }>;

function toAdminBookingListItem(booking: ListRecord) {
  return {
    id: booking.id, status: booking.status, pickupAt: booking.pickupAt,
    materialDescription: booking.materialDescription, weightKg: Number(booking.weightKg),
    estimatedFare: Number(booking.estimatedFare), customer: booking.customer,
    driver: booking.driver, vehicle: booking.vehicle, fromLocation: booking.fromLocation,
    toLocation: booking.toLocation, lrNumber: booking.lrNumber, invoiceNumber: booking.invoiceNumber,
    hasLrDocument: Boolean(booking.lrPdfUrl), hasInvoiceDocument: Boolean(booking.invoicePdfUrl),
    createdAt: booking.createdAt, updatedAt: booking.updatedAt,
  };
}

function toAdminBookingDetail(booking: DetailRecord) {
  return {
    ...toAdminBookingListItem(booking), viaRoute: booking.viaRoute,
    consignorName: booking.consignorName, consigneeName: booking.consigneeName,
    declaredValue: Number(booking.declaredValue), distanceKm: Number(booking.distanceKm),
    baseFare: Number(booking.baseFare), distanceCharge: Number(booking.distanceCharge),
    tollAmount: Number(booking.tollAmount), gstPercent: Number(booking.gstPercent),
    gstAmount: Number(booking.gstAmount), cancellationReason: booking.cancellationReason,
    cancelledAt: booking.cancelledAt, lrGeneratedAt: booking.lrGeneratedAt,
    deliveryTime: booking.deliveryTime, deliveryNotes: booking.deliveryNotes,
    invoiceGeneratedAt: booking.invoiceGeneratedAt, customer: booking.customer,
    driver: booking.driver, vehicle: { ...booking.vehicle, capacityKg: Number(booking.vehicle.capacityKg) },
  };
}

export async function getAdminBookings(query: AdminBookingQuery) {
  const conditions: Prisma.BookingWhereInput[] = [];
  if (query.status !== "all") conditions.push({ status: query.status });
  if (query.search) conditions.push({ OR: [
    { id: { contains: query.search, mode: "insensitive" } },
    { lrNumber: { contains: query.search, mode: "insensitive" } },
    { invoiceNumber: { contains: query.search, mode: "insensitive" } },
    { customer: { is: { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }, { phone: { contains: query.search, mode: "insensitive" } }] } } },
    { vehicle: { is: { regNumber: { contains: query.search, mode: "insensitive" } } } },
    { driver: { is: { name: { contains: query.search, mode: "insensitive" } } } },
  ] });
  const where: Prisma.BookingWhereInput = { AND: conditions };
  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, select: adminBookingListSelect, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
  ]);
  return { items: bookings.map(toAdminBookingListItem), total, page: query.page, limit: query.limit };
}

export async function getAdminBookingDetail(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: adminBookingDetailSelect });
  if (!booking) throw new AppError(404, "Booking not found");
  return toAdminBookingDetail(booking);
}
