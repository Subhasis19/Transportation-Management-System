import { z } from "zod";
import { positiveMoneySchema, uuidSchema } from "../../common/schemas/common.schema.js";

export const createBookingSchema = z.object({
    vehicleId: uuidSchema,
    fromLocationId: uuidSchema,
    toLocationId: uuidSchema,
    pickupAt: z.coerce.date().refine((date) => date > new Date(), "Pickup must be in the future"),
    viaRoute: z.string().trim().max(255).optional(),
    consignorName: z.string().trim().min(2).max(150),
    consigneeName: z.string().trim().min(2).max(150),
    materialDescription: z.string().trim().min(2).max(255),
    weightKg: positiveMoneySchema,
    declaredValue: positiveMoneySchema,
});

export const bookingIdParamsSchema = z.object({
    id: uuidSchema,
});

export const confirmBookingSchema = z.object({
    driverId: uuidSchema,
});

export const deliverBookingSchema = z.object({
    notes: z.string().trim().min(3).max(2000),
});

export const cancelBookingSchema = z.object({
    reason: z.string().trim().min(3).max(500),
});

export const bookingDocumentParamsSchema = z.object({
    id: uuidSchema,
    kind: z.string(),
});

export const adminBookingQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().default(""),
    status: z
        .enum(["all", "PENDING", "CONFIRMED", "IN_TRANSIT", "DELIVERED", "INVOICED", "CLOSED", "CANCELLED"])
        .default("all"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type DeliverBookingInput = z.infer<typeof deliverBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type BookingDocumentParams = z.infer<typeof bookingDocumentParamsSchema>;
export type AdminBookingQuery = z.infer<typeof adminBookingQuerySchema>;
