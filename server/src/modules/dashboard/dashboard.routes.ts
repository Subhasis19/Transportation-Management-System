import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate, allow } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { getDashboard } from "./dashboard.controller.js";

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(getDashboard),
);
