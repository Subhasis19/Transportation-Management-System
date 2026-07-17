import { z } from "zod";
import { uuidSchema } from "../../common/schemas/common.schema";

export const vehicleTypes = [
    "MINI_TRUCK",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
] as const;

const vehicleStatuses = [
    "AVAILABLE",
    "RESERVED",
    "ON_TRIP",
    "MAINTENANCE",
    "BREAKDOWN",
] as const;

const documentStatuses = ["VALID", "EXPIRING", "EXPIRED"] as const;

const normalizeNumericValue = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? Number.NaN : trimmed;
    }
    return Number.NaN;
};

const hasAtMostTwoDecimalPlaces = (value: number) => {
    const scaled = value * 100;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
    return Math.abs(scaled - Math.round(scaled)) <= tolerance;
};

const capacitySchema = z.preprocess(
    normalizeNumericValue,
    z.coerce
        .number()
        .finite()
        .positive()
        .max(99_999_999)
        .refine(hasAtMostTwoDecimalPlaces),
);

const registrationSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[\s-]+/g, ""))
    .pipe(z.string().min(4).max(20).regex(/^[A-Z0-9]+$/));

const documentNumberSchema = z.string().trim().toUpperCase().min(3).max(50);
const documentDateSchema = z.coerce.date();

export const adminVehicleQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["all", ...vehicleStatuses]).default("all"),
    vehicleType: z.enum(["all", ...vehicleTypes]).default("all"),
    documentStatus: z.enum(["all", ...documentStatuses]).default("all"),
});

export const createVehicleSchema = z
    .object({
        regNumber: registrationSchema,
        vehicleType: z.enum(vehicleTypes),
        capacityKg: capacitySchema,
        rcNumber: documentNumberSchema,
        rcExpiry: documentDateSchema,
        permitNumber: documentNumberSchema,
        permitExpiry: documentDateSchema,
    })
    .strict();

export const updateVehicleSchema = z
    .object({
        regNumber: registrationSchema.optional(),
        vehicleType: z.enum(vehicleTypes).optional(),
        capacityKg: capacitySchema.optional(),
        rcNumber: documentNumberSchema.optional(),
        rcExpiry: documentDateSchema.optional(),
        permitNumber: documentNumberSchema.optional(),
        permitExpiry: documentDateSchema.optional(),
    })
    .strict()
    .refine((value) => Object.values(value).some((field) => field !== undefined));

export const updateVehicleStatusSchema = z
    .object({ status: z.enum(["AVAILABLE", "MAINTENANCE", "BREAKDOWN"]) })
    .strict();

export const vehicleIdParamsSchema = z
    .object({ vehicleId: uuidSchema })
    .strict();

export type AdminVehicleQuery = z.infer<typeof adminVehicleQuerySchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;
