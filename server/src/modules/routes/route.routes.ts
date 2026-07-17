import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    createRouteHandler,
    getQuoteHandler,
    listAdminRoutes,
    updateRouteHandler,
    updateRouteStatusHandler,
} from "./route.controller";

export const quoteRouter = Router();
export const adminRouteRouter = Router();

quoteRouter.get("/", authenticate, asyncHandler(getQuoteHandler));

adminRouteRouter.use(authenticate, allow(Role.ADMIN));
adminRouteRouter.get("/", asyncHandler(listAdminRoutes));
adminRouteRouter.post("/", asyncHandler(createRouteHandler));
adminRouteRouter.patch("/:routeId", asyncHandler(updateRouteHandler));
adminRouteRouter.patch(
    "/:routeId/status",
    asyncHandler(updateRouteStatusHandler),
);
