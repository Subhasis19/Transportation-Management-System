import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    createOrUpdateRoute,
    getQuoteHandler,
    listAdminRoutes,
} from "./route.controller";

export const quoteRouter = Router();
export const adminRouteRouter = Router();

quoteRouter.get("/", authenticate, asyncHandler(getQuoteHandler));

adminRouteRouter.get(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(listAdminRoutes),
);
adminRouteRouter.post(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(createOrUpdateRoute),
);
