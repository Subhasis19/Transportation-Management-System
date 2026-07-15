import { z } from "zod";
import { VehicleStatus } from "../../generated/prisma/client";
import { positiveMoneySchema, uuidSchema } from "../../common/schemas/common.schema";

export const vehicleTypes = [
    "MINI_TRUCK",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
] as const;

export const createVehicleSchema = z.object({
    regNumber: z.string().trim().min(4).max(20),
    vehicleType: z.enum(vehicleTypes),
    capacityKg: positiveMoneySchema,
    rcNumber: z.string().trim().min(3).max(50),
    rcExpiry: z.coerce.date(),
    permitNumber: z.string().trim().min(3).max(50),
    permitExpiry: z.coerce.date(),
});

export const updateVehicleSchema = z.object({
    status: z.nativeEnum(VehicleStatus).optional(),
    rcExpiry: z.coerce.date().optional(),
    permitExpiry: z.coerce.date().optional(),
});

export const vehicleIdParamsSchema = z.object({
    id: uuidSchema,
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
