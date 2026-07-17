import { AppError } from "../../common/errors/app-error";
import { BookingStatus, Prisma, Role } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  activeDriverAssignmentStatuses,
  isDriverLicenseValid,
} from "../drivers/driver.rules";
import type { AdminUserQuery, UpdateUserStatusInput } from "./user.schema";
import {
  getUserActivityStatus,
  getUserActivityWhere,
} from "./user-activity";

const activeAssignmentStatusFilter: BookingStatus[] = [
  ...activeDriverAssignmentStatuses,
];

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      bookingsAsCustomer: true,
      bookingsAsDriver: true,
    },
  },
} as const satisfies Prisma.UserSelect;

const adminUserDetailSelect = {
  ...adminUserSelect,
  licenseNumber: true,
  licenseExpiry: true,
} as const satisfies Prisma.UserSelect;

const recentBookingSelect = {
  id: true,
  status: true,
  estimatedFare: true,
  pickupAt: true,
  createdAt: true,
  vehicle: { select: { id: true, regNumber: true } },
  fromLocation: { select: { id: true, cityName: true } },
  toLocation: { select: { id: true, cityName: true } },
} as const satisfies Prisma.BookingSelect;

type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;
type AdminUserDetailRecord = Prisma.UserGetPayload<{
  select: typeof adminUserDetailSelect;
}>;
type RecentBookingRecord = Prisma.BookingGetPayload<{
  select: typeof recentBookingSelect;
}>;

function toAdminUser(
  user: AdminUserRecord,
  currentAdminId: string,
  now = new Date(),
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    activityStatus: getUserActivityStatus(user.lastLoginAt, now),
    lastLoginAt: user.lastLoginAt,
    customerBookingCount: user._count.bookingsAsCustomer,
    driverAssignmentCount: user._count.bookingsAsDriver,
    isCurrentUser: user.id === currentAdminId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toRecentBooking(
  booking: RecentBookingRecord,
  relationship: "CUSTOMER" | "DRIVER",
) {
  return {
    id: booking.id,
    relationship,
    status: booking.status,
    estimatedFare: Number(booking.estimatedFare),
    pickupAt: booking.pickupAt,
    createdAt: booking.createdAt,
    vehicle: booking.vehicle,
    fromLocation: booking.fromLocation,
    toLocation: booking.toLocation,
  };
}

function mapUserError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return new AppError(404, "User not found");
  }
  return error;
}

export async function getUsers(query: AdminUserQuery, currentAdminId: string) {
  const now = new Date();
  const conditions: Prisma.UserWhereInput[] = [
    getUserActivityWhere(query.activity, now),
  ];
  if (query.role !== "all") conditions.push({ role: query.role });
  if (query.status === "active") conditions.push({ isActive: true });
  if (query.status === "inactive") conditions.push({ isActive: false });
  if (query.search) {
    conditions.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: conditions };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  return {
    items: users.map((user) => toAdminUser(user, currentAdminId, now)),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getUserDetail(userId: string, currentAdminId: string) {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: adminUserDetailSelect,
  });
  if (!user) throw new AppError(404, "User not found");

  const relationship = user.role === Role.CUSTOMER
    ? "CUSTOMER"
    : user.role === Role.DRIVER
      ? "DRIVER"
      : null;
  const recentBookings = relationship
    ? await prisma.booking.findMany({
        where:
          relationship === "CUSTOMER"
            ? { customerId: user.id }
            : { driverId: user.id },
        select: recentBookingSelect,
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const totalRelevantBookings =
    user.role === Role.CUSTOMER
      ? user._count.bookingsAsCustomer
      : user.role === Role.DRIVER
        ? user._count.bookingsAsDriver
        : 0;
  return {
    ...toAdminUser(user, currentAdminId, now),
    licenseNumber: user.licenseNumber,
    licenseExpiry: user.licenseExpiry,
    totalRelevantBookings,
    recentBookings: relationship
      ? recentBookings.map((booking) => toRecentBooking(booking, relationship))
      : [],
  };
}

export async function updateUserStatus(
  userId: string,
  currentAdminId: string,
  input: UpdateUserStatusInput,
) {
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: adminUserDetailSelect,
      });
      if (!current) throw new AppError(404, "User not found");
      if (current.isActive === input.isActive) {
        return toAdminUser(current, currentAdminId, now);
      }
      if (!input.isActive && current.id === currentAdminId) {
        throw new AppError(409, "You cannot deactivate your own account");
      }
      if (!input.isActive && current.role === Role.ADMIN) {
        const otherActiveAdmins = await tx.user.count({
          where: {
            role: Role.ADMIN,
            isActive: true,
            id: { not: current.id },
          },
        });
        if (otherActiveAdmins === 0) {
          throw new AppError(409, "At least one active admin account is required");
        }
      }
      if (!input.isActive && current.role === Role.DRIVER) {
        const activeAssignment = await tx.booking.findFirst({
          where: {
            driverId: current.id,
            status: { in: activeAssignmentStatusFilter },
          },
          select: { id: true },
        });
        if (activeAssignment) {
          throw new AppError(
            409,
            "Driver cannot be deactivated during an active trip",
          );
        }
      }
      if (
        input.isActive &&
        current.role === Role.DRIVER &&
        !isDriverLicenseValid(current.licenseNumber, current.licenseExpiry, now)
      ) {
        throw new AppError(
          409,
          "Driver cannot be activated without a valid license",
        );
      }

      const user = await tx.user.update({
        where: { id: current.id },
        data: { isActive: input.isActive },
        select: adminUserSelect,
      });
      if (!input.isActive) {
        await tx.refreshToken.deleteMany({ where: { userId: current.id } });
      }
      return toAdminUser(user, currentAdminId, now);
    });
  } catch (error) {
    throw mapUserError(error);
  }
}
