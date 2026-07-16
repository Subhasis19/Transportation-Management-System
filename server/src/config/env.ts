import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),

  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must contain at least 32 characters"),

  SUPABASE_URL: z.string().url(),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  SUPABASE_STORAGE_BUCKET: z
    .string()
    .min(1)
    .default("tms-documents"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    z.treeifyError(parsed.error),
  );

  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
