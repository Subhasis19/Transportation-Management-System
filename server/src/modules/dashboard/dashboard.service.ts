import {
  BookingStatus,
  Role,
  VehicleStatus,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  activeDriverAssignmentStatuses,
  getDriverLicenseStatus,
} from "../drivers/driver.rules";
import { getActiveUserCutoff } from "../users/user-activity";
import { getVehicleDocumentStatus } from "../vehicles/vehicle.rules";

const vehicleCount = (
  rows: Array<{ status: VehicleStatus; _count: number }>,
  status: VehicleStatus,
) => rows.find((row) => row.status === status)?._count ?? 0;
const bookingCount = (
  rows: Array<{ status: BookingStatus; _count: number }>,
  status: BookingStatus,
) => rows.find((row) => row.status === status)?._count ?? 0;

export async function getDashboardData() {
  const now = new Date();
  const attentionUntil = new Date(now.getTime() + 30 * 86400_000);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const [
    customers,
    enabledAccounts,
    recentlyActiveAccounts,
    driverTotal,
    driverEnabled,
    eligibleDrivers,
    vehicleStatuses,
    quoteReady,
    bookingStatuses,
    monthlyValue,
    vehicleAlerts,
    driverAlerts,
    recentBookings,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.CUSTOMER } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({
      where: { isActive: true, lastLoginAt: { gte: getActiveUserCutoff(now) } },
    }),
    prisma.user.count({ where: { role: Role.DRIVER } }),
    prisma.user.count({ where: { role: Role.DRIVER, isActive: true } }),
    prisma.user.count({
      where: {
        role: Role.DRIVER,
        isActive: true,
        licenseNumber: { not: null },
        licenseExpiry: { gt: now },
        bookingsAsDriver: {
          none: { status: { in: [...activeDriverAssignmentStatuses] } },
        },
      },
    }),
    prisma.vehicle.groupBy({ by: ["status"], _count: true }),
    prisma.vehicle.count({
      where: {
        status: VehicleStatus.AVAILABLE,
        rcExpiry: { gt: now },
        permitExpiry: { gt: now },
      },
    }),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.booking.aggregate({
      where: {
        status: { not: BookingStatus.CANCELLED },
        createdAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { estimatedFare: true },
    }),
    prisma.vehicle.findMany({
      where: {
        OR: [
          { rcExpiry: { lte: attentionUntil } },
          { permitExpiry: { lte: attentionUntil } },
        ],
      },
      select: {
        id: true,
        regNumber: true,
        status: true,
        rcExpiry: true,
        permitExpiry: true,
      },
      orderBy: [{ rcExpiry: "asc" }, { permitExpiry: "asc" }],
      take: 8,
    }),
    prisma.user.findMany({
      where: {
        role: Role.DRIVER,
        OR: [
          { licenseNumber: null },
          { licenseExpiry: null },
          { licenseExpiry: { lte: attentionUntil } },
        ],
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        licenseNumber: true,
        licenseExpiry: true,
      },
      orderBy: [{ licenseExpiry: "asc" }, { name: "asc" }],
      take: 8,
    }),
    prisma.booking.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        materialDescription: true,
        estimatedFare: true,
        pickupAt: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, regNumber: true } },
        fromLocation: { select: { id: true, cityName: true } },
        toLocation: { select: { id: true, cityName: true } },
      },
    }),
  ]);
  const confirmed = bookingCount(bookingStatuses, BookingStatus.CONFIRMED);
  const inTransit = bookingCount(bookingStatuses, BookingStatus.IN_TRANSIT);
  const delivered = bookingCount(bookingStatuses, BookingStatus.DELIVERED);
  const invoiced = bookingCount(bookingStatuses, BookingStatus.INVOICED);
  return {
    generatedAt: now,
    users: { customers, enabledAccounts, recentlyActiveAccounts },
    drivers: {
      total: driverTotal,
      enabled: driverEnabled,
      eligibleForAssignment: eligibleDrivers,
    },
    vehicles: {
      total: vehicleStatuses.reduce((sum, row) => sum + row._count, 0),
      available: vehicleCount(vehicleStatuses, VehicleStatus.AVAILABLE),
      quoteReady,
      reserved: vehicleCount(vehicleStatuses, VehicleStatus.RESERVED),
      onTrip: vehicleCount(vehicleStatuses, VehicleStatus.ON_TRIP),
      maintenance: vehicleCount(vehicleStatuses, VehicleStatus.MAINTENANCE),
      breakdown: vehicleCount(vehicleStatuses, VehicleStatus.BREAKDOWN),
    },
    bookings: {
      total: bookingStatuses.reduce((sum, row) => sum + row._count, 0),
      pending: bookingCount(bookingStatuses, BookingStatus.PENDING),
      active: confirmed + inTransit + delivered + invoiced,
      confirmed,
      inTransit,
      delivered,
      invoiced,
      closed: bookingCount(bookingStatuses, BookingStatus.CLOSED),
      cancelled: bookingCount(bookingStatuses, BookingStatus.CANCELLED),
    },
    monthlyBookingValue: Number(monthlyValue._sum.estimatedFare ?? 0),
    vehicleDocumentAlerts: vehicleAlerts
      .map((vehicle) => ({
        ...vehicle,
        documentStatus: getVehicleDocumentStatus(
          vehicle.rcExpiry,
          vehicle.permitExpiry,
          now,
        ),
      }))
      .filter((vehicle) => vehicle.documentStatus !== "VALID"),
    driverLicenseAlerts: driverAlerts
      .map((driver) => ({
        ...driver,
        licenseStatus: getDriverLicenseStatus(
          driver.licenseNumber,
          driver.licenseExpiry,
          now,
        ),
      }))
      .filter((driver) => driver.licenseStatus !== "VALID"),
    recentBookings: recentBookings.map((booking) => ({
      ...booking,
      estimatedFare: Number(booking.estimatedFare),
    })),
  };
}
