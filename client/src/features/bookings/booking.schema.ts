import { z } from "zod";

export const bookingSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  pickupAt: z.string().min(1),
  vehicleId: z.string().uuid(),
  consignorName: z.string().min(2),
  consigneeName: z.string().min(2),
  materialDescription: z.string().min(2),
  weightKg: z.coerce.number().positive(),
  declaredValue: z.coerce.number().positive(),
  viaRoute: z.string().optional(),
});
