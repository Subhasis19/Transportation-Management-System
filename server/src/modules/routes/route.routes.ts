import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate, allow } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import {
    createRouteHandler,
    getQuoteHandler,
    listAdminRoutes,
    updateRouteHandler,
    updateRouteStatusHandler,
} from "./route.controller.js";

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
