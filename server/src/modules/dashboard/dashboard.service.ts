import { BookingStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const bookingInclude = {
    customer: { select: { id: true, name: true, email: true } },
    driver: { select: { id: true, name: true } },
    vehicle: true,
    fromLocation: true,
    toLocation: true,
} as const;

export async function getDashboardData() {
    const [vehicles, bookings, revenue, expiringDocuments, recentBookings] =
        await Promise.all([
            prisma.vehicle.groupBy({ by: ["status"], _count: true }),
            prisma.booking.groupBy({ by: ["status"], _count: true }),
            prisma.booking.aggregate({
                where: {
                    status: { in: [BookingStatus.INVOICED, BookingStatus.CLOSED] },
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                _sum: { estimatedFare: true },
            }),
            prisma.vehicle.findMany({
                where: {
                    OR: [
                        { rcExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
                        { permitExpiry: { lte: new Date(Date.now() + 30 * 86400_000) } },
                    ],
                },
                select: {
                    id: true,
                    regNumber: true,
                    rcExpiry: true,
                    permitExpiry: true,
                },
            }),
            prisma.booking.findMany({
                take: 8,
                orderBy: { createdAt: "desc" },
                include: bookingInclude,
            }),
        ]);

    return {
        vehicles,
        bookings,
        revenueThisMonth: Number(revenue._sum.estimatedFare || 0),
        expiringDocuments,
        recentBookings,
    };
}
