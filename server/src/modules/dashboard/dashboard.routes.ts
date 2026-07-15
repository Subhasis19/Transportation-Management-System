import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { getDashboard } from "./dashboard.controller";

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(getDashboard),
);
