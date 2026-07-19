import { z } from "zod";
import { vehicleTypes } from "../vehicles/vehicle.schema.js";

const hasAtMostTwoDecimalPlaces = (value: number) => {
    const scaled = value * 100;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
    return Math.abs(scaled - Math.round(scaled)) <= tolerance;
};

const normalizePricingNumericValue = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? Number.NaN : trimmed;
    }
    return Number.NaN;
};

const pricingAmountSchema = (maximum: number) =>
    z.preprocess(
        normalizePricingNumericValue,
        z.coerce
            .number()
            .finite()
            .min(0)
            .max(maximum)
            .refine(hasAtMostTwoDecimalPlaces),
    );

export const updatePricingSchema = z
    .object({
        baseFare: pricingAmountSchema(99_999_999).optional(),
        perKmRate: pricingAmountSchema(99_999_999).optional(),
        gstPercent: pricingAmountSchema(100).optional(),
    })
    .strict()
    .refine((value) => Object.values(value).some((field) => field !== undefined));

export const vehicleTypeParamsSchema = z
    .object({ vehicleType: z.enum(vehicleTypes) })
    .strict();

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;
