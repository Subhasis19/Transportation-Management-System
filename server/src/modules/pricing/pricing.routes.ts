import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { authenticate, allow } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { listRateCards, updateRateCardHandler } from "./pricing.controller.js";

export const adminPricingRouter = Router();

adminPricingRouter.use(authenticate, allow(Role.ADMIN));
adminPricingRouter.get("/", asyncHandler(listRateCards));
adminPricingRouter.patch(
    "/:vehicleType",
    asyncHandler(updateRateCardHandler),
);
