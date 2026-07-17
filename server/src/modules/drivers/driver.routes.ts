import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    createDriverHandler,
    listDriverOptions,
    listDrivers,
    updateDriverHandler,
    updateDriverStatusHandler,
} from "./driver.controller";

export const adminDriverRouter = Router();

adminDriverRouter.use(authenticate, allow(Role.ADMIN));
adminDriverRouter.get("/", asyncHandler(listDrivers));
adminDriverRouter.get("/options", asyncHandler(listDriverOptions));
adminDriverRouter.post("/", asyncHandler(createDriverHandler));
adminDriverRouter.patch("/:driverId", asyncHandler(updateDriverHandler));
adminDriverRouter.patch(
    "/:driverId/status",
    asyncHandler(updateDriverStatusHandler),
);
