import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { allow, authenticate } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import {
  getUserDetailHandler,
  listUsers,
  updateUserStatusHandler,
} from "./user.controller.js";

export const adminUserRouter = Router();

adminUserRouter.use(authenticate, allow(Role.ADMIN));
adminUserRouter.get("/", asyncHandler(listUsers));
adminUserRouter.get("/:userId", asyncHandler(getUserDetailHandler));
adminUserRouter.patch("/:userId/status", asyncHandler(updateUserStatusHandler));
