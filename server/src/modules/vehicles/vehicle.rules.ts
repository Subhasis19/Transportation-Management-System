import { BookingStatus, type Prisma } from "../../generated/prisma/client.js";

export const activeVehicleBookingStatuses = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.IN_TRANSIT,
    BookingStatus.INVOICED,
] as const;

export type VehicleDocumentStatus = "VALID" | "EXPIRING" | "EXPIRED";

export function getVehicleDocumentStatus(
    rcExpiry: Date,
    permitExpiry: Date,
    now = new Date(),
): VehicleDocumentStatus {
    const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    if (rcExpiry <= now || permitExpiry <= now) return "EXPIRED";
    if (rcExpiry <= thirtyDaysFromNow || permitExpiry <= thirtyDaysFromNow)
        return "EXPIRING";
    return "VALID";
}

export function getDocumentStatusWhere(
    documentStatus: "all" | VehicleDocumentStatus,
    now: Date,
): Prisma.VehicleWhereInput {
    const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    if (documentStatus === "EXPIRED") {
        return {
            OR: [{ rcExpiry: { lte: now } }, { permitExpiry: { lte: now } }],
        };
    }
    if (documentStatus === "EXPIRING") {
        return {
            AND: [
                { rcExpiry: { gt: now } },
                { permitExpiry: { gt: now } },
                {
                    OR: [
                        { rcExpiry: { lte: thirtyDaysFromNow } },
                        { permitExpiry: { lte: thirtyDaysFromNow } },
                    ],
                },
            ],
        };
    }
    if (documentStatus === "VALID") {
        return {
            rcExpiry: { gt: thirtyDaysFromNow },
            permitExpiry: { gt: thirtyDaysFromNow },
        };
    }
    return {};
}
