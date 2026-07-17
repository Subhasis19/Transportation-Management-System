import { Router } from "express";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { Role } from "../../generated/prisma/client";
import {
    createLocationHandler,
    listAdminLocations,
    listLocations,
    updateLocationHandler,
    updateLocationStatusHandler,
} from "./location.controller";

export const locationRouter = Router();
export const adminLocationRouter = Router();

locationRouter.get("/", authenticate, asyncHandler(listLocations));

adminLocationRouter.use(authenticate, allow(Role.ADMIN));
adminLocationRouter.get("/", asyncHandler(listAdminLocations));
adminLocationRouter.post("/", asyncHandler(createLocationHandler));
adminLocationRouter.patch("/:locationId", asyncHandler(updateLocationHandler));
adminLocationRouter.patch("/:locationId/status", asyncHandler(updateLocationStatusHandler));
