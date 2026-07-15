import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const moneySchema = z.coerce
    .number()
    .finite()
    .min(0)
    .max(99_999_999);

export const positiveMoneySchema =
    moneySchema.positive();

export const paginationSchema = z.object({
    page: z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20),
});