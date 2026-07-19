import type { Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import type { AuthRequest } from "../../lib/auth.js";
import {
  adminUserQuerySchema,
  updateUserStatusSchema,
  userIdParamsSchema,
} from "./user.schema.js";
import { getUserDetail, getUsers, updateUserStatus } from "./user.service.js";

function currentAdminId(req: AuthRequest) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user.id;
}

export async function listUsers(req: AuthRequest, res: Response) {
  res.json(
    await getUsers(adminUserQuerySchema.parse(req.query), currentAdminId(req)),
  );
}

export async function getUserDetailHandler(req: AuthRequest, res: Response) {
  const { userId } = userIdParamsSchema.parse(req.params);
  res.json(await getUserDetail(userId, currentAdminId(req)));
}

export async function updateUserStatusHandler(req: AuthRequest, res: Response) {
  const { userId } = userIdParamsSchema.parse(req.params);
  res.json(
    await updateUserStatus(
      userId,
      currentAdminId(req),
      updateUserStatusSchema.parse(req.body),
    ),
  );
}
