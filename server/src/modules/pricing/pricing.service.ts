import { AppError } from "../../common/errors/app-error";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { vehicleTypes } from "../vehicles/vehicle.schema";
import type { UpdatePricingInput } from "./pricing.schema";

const adminRateCardSelect = {
    id: true,
    vehicleType: true,
    baseFare: true,
    perKmRate: true,
    gstPercent: true,
    createdAt: true,
    updatedAt: true,
} as const;

function toAdminRateCard(
    rateCard: Prisma.PricingGetPayload<{ select: typeof adminRateCardSelect }>,
) {
    return {
        id: rateCard.id,
        vehicleType: rateCard.vehicleType,
        baseFare: Number(rateCard.baseFare),
        perKmRate: Number(rateCard.perKmRate),
        gstPercent: Number(rateCard.gstPercent),
        createdAt: rateCard.createdAt,
        updatedAt: rateCard.updatedAt,
    };
}

export async function getRateCards() {
    const rateCards = await prisma.pricing.findMany({
        select: adminRateCardSelect,
        orderBy: { vehicleType: "asc" },
    });

    return rateCards.map(toAdminRateCard);
}

export async function updateRateCard(
    vehicleType: (typeof vehicleTypes)[number],
    input: UpdatePricingInput,
) {
    try {
        const rateCard = await prisma.pricing.update({
            where: { vehicleType },
            data: input,
            select: adminRateCardSelect,
        });

        return toAdminRateCard(rateCard);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025"
        ) {
            throw new AppError(404, "Rate card not found");
        }

        throw error;
    }
}
