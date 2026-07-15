import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { authenticate, allow } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import { listDrivers } from "./driver.controller";

export const adminDriverRouter = Router();

adminDriverRouter.get("/", authenticate, allow(Role.ADMIN), asyncHandler(listDrivers));
