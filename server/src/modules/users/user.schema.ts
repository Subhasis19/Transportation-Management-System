import { z } from "zod";
import { uuidSchema } from "../../common/schemas/common.schema.js";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().default(""),
  role: z.enum(["all", "ADMIN", "CUSTOMER", "DRIVER"]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  activity: z.enum(["all", "recent", "stale", "never"]).default("all"),
});

export const userIdParamsSchema = z.object({ userId: uuidSchema }).strict();

export const updateUserStatusSchema = z
  .object({ isActive: z.boolean() })
  .strict();

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
