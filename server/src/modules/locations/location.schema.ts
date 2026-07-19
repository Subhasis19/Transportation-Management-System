import { z } from "zod";
import { normalizeLocationName } from "./location.rules.js";

const cityNameSchema = z.string().transform(normalizeLocationName).pipe(z.string().min(2).max(100));

export const createLocationSchema = z.object({ cityName: cityNameSchema }).strict();
export const updateLocationSchema = z.object({ cityName: cityNameSchema }).strict();
export const updateLocationStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const locationParamsSchema = z.object({ locationId: z.string().uuid() }).strict();
export const adminLocationQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type UpdateLocationStatusInput = z.infer<typeof updateLocationStatusSchema>;
export type AdminLocationQuery = z.infer<typeof adminLocationQuerySchema>;
