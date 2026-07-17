import { BookingStatus, Prisma } from "../../generated/prisma/client";

export const activeDriverAssignmentStatuses = [
    BookingStatus.CONFIRMED,
    BookingStatus.IN_TRANSIT,
] as const;

export type DriverLicenseStatus =
    | "VALID"
    | "EXPIRING"
    | "EXPIRED"
    | "MISSING";

function startOfToday(now: Date) {
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    return today;
}

function expiringThreshold(now: Date) {
    const threshold = startOfToday(now);
    threshold.setUTCDate(threshold.getUTCDate() + 30);
    return threshold;
}

export function isDriverLicenseValid(
    licenseNumber: string | null,
    licenseExpiry: Date | null,
    now = new Date(),
) {
    return Boolean(licenseNumber && licenseExpiry && licenseExpiry > startOfToday(now));
}

export function getDriverLicenseStatus(
    licenseNumber: string | null,
    licenseExpiry: Date | null,
    now = new Date(),
): DriverLicenseStatus {
    if (!licenseNumber || !licenseExpiry) return "MISSING";
    if (licenseExpiry <= startOfToday(now)) return "EXPIRED";
    if (licenseExpiry <= expiringThreshold(now)) return "EXPIRING";
    return "VALID";
}

export function getDriverLicenseStatusWhere(
    licenseStatus: "all" | DriverLicenseStatus,
    now = new Date(),
): Prisma.UserWhereInput {
    const today = startOfToday(now);
    const threshold = expiringThreshold(now);

    switch (licenseStatus) {
        case "MISSING":
            return {
                OR: [{ licenseNumber: null }, { licenseExpiry: null }],
            };
        case "EXPIRED":
            return {
                licenseNumber: { not: null },
                licenseExpiry: { not: null, lte: today },
            };
        case "EXPIRING":
            return {
                licenseNumber: { not: null },
                licenseExpiry: { not: null, gt: today, lte: threshold },
            };
        case "VALID":
            return {
                licenseNumber: { not: null },
                licenseExpiry: { not: null, gt: threshold },
            };
        case "all":
            return {};
    }
}
