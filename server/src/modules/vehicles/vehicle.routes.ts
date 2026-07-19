import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate, allow } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import {
    createVehicleHandler,
    listVehicles,
    updateVehicleHandler,
    updateVehicleStatusHandler,
} from "./vehicle.controller.js";

export const adminVehicleRouter = Router();

adminVehicleRouter.use(authenticate, allow(Role.ADMIN));
adminVehicleRouter.get("/", asyncHandler(listVehicles));
adminVehicleRouter.post("/", asyncHandler(createVehicleHandler));
adminVehicleRouter.patch("/:vehicleId", asyncHandler(updateVehicleHandler));
adminVehicleRouter.patch(
    "/:vehicleId/status",
    asyncHandler(updateVehicleStatusHandler),
);
