import { prisma } from "../../lib/prisma";
import type { UpdatePricingInput } from "./pricing.schema";

export async function getRateCards() {
    return prisma.pricing.findMany({ orderBy: { vehicleType: "asc" } });
}

export async function updateRateCard(vehicleType: string, input: UpdatePricingInput) {
    return prisma.pricing.update({ where: { vehicleType }, data: input });
}
