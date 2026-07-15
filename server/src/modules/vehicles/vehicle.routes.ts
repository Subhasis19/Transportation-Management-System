import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    createVehicleHandler,
    listVehicles,
    updateVehicleHandler,
} from "./vehicle.controller";

export const adminVehicleRouter = Router();

adminVehicleRouter.get("/", authenticate, allow(Role.ADMIN), asyncHandler(listVehicles));
adminVehicleRouter.post(
    "/",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(createVehicleHandler),
);
adminVehicleRouter.patch(
    "/:id",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(updateVehicleHandler),
);
