import { z } from "zod";
import { uuidSchema } from "../../common/schemas/common.schema.js";
import { isDriverLicenseValid } from "./driver.rules.js";

const driverNameSchema = z.string().trim().min(2).max(100);
const driverEmailSchema = z.string().email().max(150).transform((value) => value.toLowerCase());
const driverPhoneSchema = z.string().trim().regex(/^\+?[0-9]{10,15}$/);
const driverLicenseNumberSchema = z.string().trim().min(3).max(50).transform((value) => value.toUpperCase());
const driverLicenseExpirySchema = z.coerce.date();

const editableDriverFields = {
    name: driverNameSchema,
    email: driverEmailSchema,
    phone: driverPhoneSchema,
    licenseNumber: driverLicenseNumberSchema,
    licenseExpiry: driverLicenseExpirySchema,
};

export const adminDriverQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().default(""),
    status: z.enum(["all", "active", "inactive"]).default("all"),
    licenseStatus: z
        .enum(["all", "VALID", "EXPIRING", "EXPIRED", "MISSING"])
        .default("all"),
});

export const createDriverSchema = z
    .object(editableDriverFields)
    .strict()
    .refine(
        (input) => isDriverLicenseValid(input.licenseNumber, input.licenseExpiry),
        "License expiry must be later than today",
    );

export const updateDriverSchema = z
    .object(editableDriverFields)
    .partial()
    .strict()
    .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const updateDriverStatusSchema = z
    .object({ isActive: z.boolean() })
    .strict();

export const driverIdParamsSchema = z.object({ driverId: uuidSchema }).strict();

export type AdminDriverQuery = z.infer<typeof adminDriverQuerySchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type UpdateDriverStatusInput = z.infer<typeof updateDriverStatusSchema>;
