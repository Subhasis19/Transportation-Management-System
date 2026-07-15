import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email(),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
    password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
