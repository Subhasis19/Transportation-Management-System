import { z } from "zod";
import { moneySchema, uuidSchema } from "../../common/schemas/common.schema";

export const quoteQuerySchema = z.object({
    fromLocationId: uuidSchema,
    toLocationId: uuidSchema,
});

export const createRouteSchema = z.object({
    fromLocationId: uuidSchema,
    toLocationId: uuidSchema,
    distanceKm: z.coerce.number().positive().max(99_999),
    tollAmount: moneySchema,
});

export type QuoteQueryInput = z.infer<typeof quoteQuerySchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
