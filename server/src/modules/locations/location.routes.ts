import { Router } from "express";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { Role } from "../../generated/prisma/client";
import {
    createLocationHandler,
    listLocations,
} from "./location.controller";

export const locationRouter = Router();
export const adminLocationRouter = Router();

locationRouter.get("/", authenticate, asyncHandler(listLocations));

adminLocationRouter.post(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(createLocationHandler),
);
