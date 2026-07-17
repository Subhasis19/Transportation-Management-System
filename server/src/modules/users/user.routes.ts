import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { allow, authenticate } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
  getUserDetailHandler,
  listUsers,
  updateUserStatusHandler,
} from "./user.controller";

export const adminUserRouter = Router();

adminUserRouter.use(authenticate, allow(Role.ADMIN));
adminUserRouter.get("/", asyncHandler(listUsers));
adminUserRouter.get("/:userId", asyncHandler(getUserDetailHandler));
adminUserRouter.patch("/:userId/status", asyncHandler(updateUserStatusHandler));
