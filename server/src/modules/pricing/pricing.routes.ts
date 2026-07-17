import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { listRateCards, updateRateCardHandler } from "./pricing.controller";

export const adminPricingRouter = Router();

adminPricingRouter.use(authenticate, allow(Role.ADMIN));
adminPricingRouter.get("/", asyncHandler(listRateCards));
adminPricingRouter.patch(
    "/:vehicleType",
    asyncHandler(updateRateCardHandler),
);
