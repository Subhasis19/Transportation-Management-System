import { z } from "zod";
import { moneySchema, uuidSchema } from "../../common/schemas/common.schema";
import { hasAtMostTwoDecimalPlaces } from "./route.rules";

export const quoteQuerySchema = z.object({
  fromLocationId: uuidSchema,
  toLocationId: uuidSchema,
});

export const createRouteSchema = z
  .object({
    fromLocationId: uuidSchema,
    toLocationId: uuidSchema,
    distanceKm: z.coerce
      .number()
      .finite()
      .positive()
      .max(99_999)
      .refine(hasAtMostTwoDecimalPlaces),
    tollAmount: moneySchema.refine(hasAtMostTwoDecimalPlaces),
  })
  .strict()
  .refine((value) => value.fromLocationId !== value.toLocationId, {
    message: "Origin and destination must differ",
  });

export const adminRouteQuerySchema = z.object({
    search: z.string().trim().max(100).default(""),
    status: z.enum(["all", "active", "inactive"]).default("all"),
});
export const updateRouteSchema = z
  .object({
    fromLocationId: uuidSchema.optional(),
    toLocationId: uuidSchema.optional(),
    distanceKm: z.coerce
      .number()
      .finite()
      .positive()
      .max(99_999)
      .refine(hasAtMostTwoDecimalPlaces)
      .optional(),
    tollAmount: moneySchema.refine(hasAtMostTwoDecimalPlaces).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const updateRouteStatusSchema = z
    .object({ isActive: z.boolean() })
    .strict();
export const routeParamsSchema = z.object({ routeId: uuidSchema }).strict();

export type QuoteQueryInput = z.infer<typeof quoteQuerySchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type AdminRouteQuery = z.infer<typeof adminRouteQuerySchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type UpdateRouteStatusInput = z.infer<typeof updateRouteStatusSchema>;
