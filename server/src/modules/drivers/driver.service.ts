import { Role } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

export async function getActiveDrivers() {
    return prisma.user.findMany({
        where: { role: Role.DRIVER, isActive: true },
        select: {
            id: true,
            name: true,
            licenseNumber: true,
            licenseExpiry: true,
        },
    });
}
