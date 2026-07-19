import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate, allow } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import {
    createDriverHandler,
    listDriverOptions,
    listDrivers,
    updateDriverHandler,
    updateDriverStatusHandler,
} from "./driver.controller.js";

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
