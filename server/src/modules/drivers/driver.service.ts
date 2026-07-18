import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { BookingStatus, Prisma, Role } from "../../generated/prisma/client";
import { setUserAccessRevoked } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import type {
    AdminDriverQuery,
    CreateDriverInput,
    UpdateDriverInput,
    UpdateDriverStatusInput,
} from "./driver.schema";
import {
    activeDriverAssignmentStatuses,
    getDriverLicenseStatus,
    getDriverLicenseStatusWhere,
    isDriverLicenseValid,
} from "./driver.rules";

const activeAssignmentStatusFilter: BookingStatus[] = [
    ...activeDriverAssignmentStatuses,
];

const adminDriverSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    licenseNumber: true,
    licenseExpiry: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    bookingsAsDriver: {
        where: { status: { in: activeAssignmentStatusFilter } },
        take: 1,
        select: {
            id: true,
            status: true,
            vehicle: { select: { id: true, regNumber: true } },
            fromLocation: { select: { id: true, cityName: true } },
            toLocation: { select: { id: true, cityName: true } },
        },
    },
} as const satisfies Prisma.UserSelect;

type AdminDriverRecord = Prisma.UserGetPayload<{
    select: typeof adminDriverSelect;
}>;

function toAdminDriver(driver: AdminDriverRecord, now = new Date()) {
    const activeAssignment = driver.bookingsAsDriver[0] ?? null;
    return {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        licenseExpiry: driver.licenseExpiry,
        licenseStatus: getDriverLicenseStatus(
            driver.licenseNumber,
            driver.licenseExpiry,
            now,
        ),
        isActive: driver.isActive,
        activeAssignment: activeAssignment
            ? {
                  id: activeAssignment.id,
                  status: activeAssignment.status,
                  vehicle: activeAssignment.vehicle,
                  fromLocation: activeAssignment.fromLocation,
                  toLocation: activeAssignment.toLocation,
              }
            : null,
        lastLoginAt: driver.lastLoginAt,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
    };
}

function duplicateErrorForTarget(target: unknown) {
    const fields = Array.isArray(target)
        ? target.filter((field): field is string => typeof field === "string")
        : [];
    if (fields.includes("email")) return new AppError(409, "Email address already exists");
    if (fields.includes("phone")) return new AppError(409, "Phone number already exists");
    return new AppError(409, "A driver with these details already exists");
}

function mapDriverError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") return new AppError(404, "Driver not found");
        if (error.code === "P2002") return duplicateErrorForTarget(error.meta?.target);
    }
    return error;
}

async function ensureNoDuplicates(
    tx: Prisma.TransactionClient | typeof prisma,
    input: Pick<CreateDriverInput, "email" | "phone"> & {
        licenseNumber: string | null;
    },
    excludedDriverId?: string,
) {
    const excluded = excludedDriverId ? { not: excludedDriverId } : undefined;
    const [email, phone, licenseNumber] = await Promise.all([
        tx.user.findFirst({ where: { email: input.email, id: excluded }, select: { id: true } }),
        tx.user.findFirst({ where: { phone: input.phone, id: excluded }, select: { id: true } }),
        input.licenseNumber
            ? tx.user.findFirst({
                  where: {
                      role: Role.DRIVER,
                      licenseNumber: input.licenseNumber,
                      id: excluded,
                  },
                  select: { id: true },
              })
            : Promise.resolve(null),
    ]);
    if (email) throw new AppError(409, "Email address already exists");
    if (phone) throw new AppError(409, "Phone number already exists");
    if (licenseNumber) throw new AppError(409, "License number already exists");
}

function generateTemporaryPassword() {
    return `${randomBytes(9).toString("base64url")}Aa1!`;
}

export async function getDrivers(query: AdminDriverQuery) {
    const now = new Date();
    const conditions: Prisma.UserWhereInput[] = [
        { role: Role.DRIVER },
        getDriverLicenseStatusWhere(query.licenseStatus, now),
    ];
    if (query.status === "active") conditions.push({ isActive: true });
    if (query.status === "inactive") conditions.push({ isActive: false });
    if (query.search) {
        conditions.push({
            OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
                { licenseNumber: { contains: query.search, mode: "insensitive" } },
            ],
        });
    }
    const where: Prisma.UserWhereInput = { AND: conditions };
    const [total, drivers] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            select: adminDriverSelect,
            orderBy: { name: "asc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
    ]);
    return {
        items: drivers.map((driver) => toAdminDriver(driver, now)),
        total,
        page: query.page,
        limit: query.limit,
    };
}

export async function getDriverOptions() {
    const now = new Date();
    return prisma.user.findMany({
        where: {
            role: Role.DRIVER,
            isActive: true,
            licenseNumber: { not: null },
            licenseExpiry: { gt: now },
            bookingsAsDriver: {
                none: { status: { in: activeAssignmentStatusFilter } },
            },
        },
        select: {
            id: true,
            name: true,
            licenseNumber: true,
            licenseExpiry: true,
        },
        orderBy: { name: "asc" },
    }).then((drivers) =>
        drivers.flatMap((driver) =>
            driver.licenseNumber && driver.licenseExpiry
                ? [{ ...driver, licenseNumber: driver.licenseNumber }]
                : [],
        ),
    );
}

export async function createDriver(input: CreateDriverInput) {
    const temporaryPassword = generateTemporaryPassword();
    try {
        await ensureNoDuplicates(prisma, input);
        const driver = await prisma.user.create({
            data: {
                ...input,
                passwordHash: await bcrypt.hash(temporaryPassword, 12),
                role: Role.DRIVER,
                isActive: true,
                lastLoginAt: null,
            },
            select: adminDriverSelect,
        });
        return { driver: toAdminDriver(driver), temporaryPassword };
    } catch (error) {
        throw mapDriverError(error);
    }
}

export async function updateDriver(driverId: string, input: UpdateDriverInput) {
    try {
        return await prisma.$transaction(async (tx) => {
            const current = await tx.user.findFirst({
                where: { id: driverId, role: Role.DRIVER },
                select: adminDriverSelect,
            });
            if (!current) throw new AppError(404, "Driver not found");

            const finalValues = {
                name: input.name ?? current.name,
                email: input.email ?? current.email,
                phone: input.phone ?? current.phone,
                licenseNumber: input.licenseNumber ?? current.licenseNumber,
                licenseExpiry: input.licenseExpiry ?? current.licenseExpiry,
            };
            await ensureNoDuplicates(tx, {
                email: finalValues.email,
                phone: finalValues.phone,
                licenseNumber: finalValues.licenseNumber,
            }, driverId);
            if (
                current.isActive &&
                !isDriverLicenseValid(
                    finalValues.licenseNumber,
                    finalValues.licenseExpiry,
                )
            ) {
                throw new AppError(409, "Active drivers must have a valid license");
            }

            const driver = await tx.user.update({
                where: { id: driverId },
                data: input,
                select: adminDriverSelect,
            });
            return toAdminDriver(driver);
        });
    } catch (error) {
        throw mapDriverError(error);
    }
}

export async function updateDriverStatus(
    driverId: string,
    input: UpdateDriverStatusInput,
) {
    try {
        const driver = await prisma.$transaction(async (tx) => {
            const current = await tx.user.findFirst({
                where: { id: driverId, role: Role.DRIVER },
                select: adminDriverSelect,
            });
            if (!current) throw new AppError(404, "Driver not found");
            if (current.isActive === input.isActive) return toAdminDriver(current);
            if (!input.isActive && current.bookingsAsDriver[0]) {
                throw new AppError(
                    409,
                    "Driver cannot be deactivated during an active trip",
                );
            }
            if (
                input.isActive &&
                !isDriverLicenseValid(current.licenseNumber, current.licenseExpiry)
            ) {
                throw new AppError(
                    409,
                    "Driver cannot be activated without a valid license",
                );
            }

            const driver = await tx.user.update({
                where: { id: driverId },
                data: { isActive: input.isActive },
                select: adminDriverSelect,
            });
            if (!input.isActive) {
                await tx.refreshToken.deleteMany({ where: { userId: driverId } });
            }
            return toAdminDriver(driver);
        });
        setUserAccessRevoked(driverId, !input.isActive);
        return driver;
    } catch (error) {
        throw mapDriverError(error);
    }
}
