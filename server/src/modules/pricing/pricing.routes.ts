import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { listRateCards, updateRateCardHandler } from "./pricing.controller";

export const adminPricingRouter = Router();

adminPricingRouter.get("/", authenticate, allow(Role.ADMIN), asyncHandler(listRateCards));
adminPricingRouter.patch(
    "/:vehicleType",
    authenticate,
    allow(Role.ADMIN),
    asyncHandler(updateRateCardHandler),
);
