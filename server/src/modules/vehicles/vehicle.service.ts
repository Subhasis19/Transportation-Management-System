import { prisma } from "../../lib/prisma";
import type { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.schema";

export async function getVehicles() {
    return prisma.vehicle.findMany({
        include: { rateCard: true },
        orderBy: { regNumber: "asc" },
    });
}

export async function createVehicle(input: CreateVehicleInput) {
    return prisma.vehicle.create({ data: input });
}

export async function updateVehicle(id: string, input: UpdateVehicleInput) {
    return prisma.vehicle.update({ where: { id }, data: input });
}
