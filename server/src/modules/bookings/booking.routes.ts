import { Router } from "express";
import { Role } from "../../generated/prisma/client";
import { allow, authenticate } from "../../lib/auth";
import { asyncHandler } from "../../middleware/async-handler";
import {
    cancelBookingHandler,
    closeBookingHandler,
    confirmBookingHandler,
    createBookingHandler,
    deliverBookingHandler,
    departBookingHandler,
    getBookingDocumentHandler,
    listMyBookings,
} from "./booking.controller";

export const bookingRouter = Router();
export const adminBookingRouter = Router();
export const driverBookingRouter = Router();

bookingRouter.post("/", authenticate, allow(Role.CUSTOMER), asyncHandler(createBookingHandler));
bookingRouter.get("/mine", authenticate, asyncHandler(listMyBookings));
bookingRouter.get("/:id/documents/:kind", authenticate, asyncHandler(getBookingDocumentHandler));

adminBookingRouter.post("/:id/confirm", authenticate, allow(Role.ADMIN), asyncHandler(confirmBookingHandler));
adminBookingRouter.post("/:id/depart", authenticate, allow(Role.ADMIN), asyncHandler(departBookingHandler));
adminBookingRouter.post("/:id/close", authenticate, allow(Role.ADMIN), asyncHandler(closeBookingHandler));
adminBookingRouter.post("/:id/cancel", authenticate, allow(Role.ADMIN), asyncHandler(cancelBookingHandler));

driverBookingRouter.post("/:id/deliver", authenticate, allow(Role.DRIVER), asyncHandler(deliverBookingHandler));
