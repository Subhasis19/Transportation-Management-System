import { z } from "zod";
import { uuidSchema } from "../../common/schemas/common.schema";
import { hasAtMostTwoDecimalPlaces } from "./route.rules";

const normalizeRouteNumericValue = (value: unknown) => {
  if (
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return Number.NaN;
  }

  return value;
};

const routeDistanceSchema = z.preprocess(
  normalizeRouteNumericValue,
  z.coerce
    .number()
    .finite()
    .positive()
    .max(99_999)
    .refine(hasAtMostTwoDecimalPlaces),
);

const routeTollSchema = z.preprocess(
  normalizeRouteNumericValue,
  z.coerce
    .number()
    .finite()
    .min(0)
    .max(99_999_999)
    .refine(hasAtMostTwoDecimalPlaces),
);

export const quoteQuerySchema = z.object({
  fromLocationId: uuidSchema,
  toLocationId: uuidSchema,
});

export const createRouteSchema = z
  .object({
    fromLocationId: uuidSchema,
    toLocationId: uuidSchema,
    distanceKm: routeDistanceSchema,
    tollAmount: routeTollSchema,
  })
  .strict();

export const adminRouteQuerySchema = z.object({
    search: z.string().trim().max(100).default(""),
    status: z.enum(["all", "active", "inactive"]).default("all"),
});
export const updateRouteSchema = z
  .object({
    fromLocationId: uuidSchema.optional(),
    toLocationId: uuidSchema.optional(),
    distanceKm: routeDistanceSchema.optional(),
    tollAmount: routeTollSchema.optional(),
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
