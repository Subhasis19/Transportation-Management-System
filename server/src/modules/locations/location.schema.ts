import { z } from "zod";

export const createLocationSchema = z.object({
    cityName: z.string().trim().min(2).max(100),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
