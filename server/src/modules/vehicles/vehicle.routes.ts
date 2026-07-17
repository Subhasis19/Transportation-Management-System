import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    createVehicleHandler,
    listVehicles,
    updateVehicleHandler,
    updateVehicleStatusHandler,
} from "./vehicle.controller";

export const adminVehicleRouter = Router();

adminVehicleRouter.use(authenticate, allow(Role.ADMIN));
adminVehicleRouter.get("/", asyncHandler(listVehicles));
adminVehicleRouter.post("/", asyncHandler(createVehicleHandler));
adminVehicleRouter.patch("/:vehicleId", asyncHandler(updateVehicleHandler));
adminVehicleRouter.patch(
    "/:vehicleId/status",
    asyncHandler(updateVehicleStatusHandler),
);
