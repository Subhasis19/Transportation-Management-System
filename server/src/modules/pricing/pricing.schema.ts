import { z } from "zod";
import { moneySchema } from "../../common/schemas/common.schema";
import { vehicleTypes } from "../vehicles/vehicle.schema";

export const updatePricingSchema = z.object({
    baseFare: moneySchema,
    perKmRate: moneySchema,
    gstPercent: z.coerce.number().min(0).max(100),
});

export const vehicleTypeParamsSchema = z.object({
    vehicleType: z.enum(vehicleTypes),
});

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;
