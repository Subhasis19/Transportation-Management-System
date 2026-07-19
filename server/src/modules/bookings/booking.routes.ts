import { Router } from "express";
import { Role } from "../../generated/prisma/client.js";
import { allow, authenticate } from "../../lib/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import {
    cancelBookingHandler,
    closeBookingHandler,
    confirmBookingHandler,
    createBookingHandler,
    deliverBookingHandler,
    departBookingHandler,
    getBookingDocumentHandler,
    getAdminBookingDetailHandler,
    listAdminBookings,
    listMyBookings,
} from "./booking.controller.js";

export const bookingRouter = Router();
export const adminBookingRouter = Router();
export const driverBookingRouter = Router();

bookingRouter.post("/", authenticate, allow(Role.CUSTOMER), asyncHandler(createBookingHandler));
bookingRouter.get("/mine", authenticate, asyncHandler(listMyBookings));
bookingRouter.get("/:id/documents/:kind", authenticate, asyncHandler(getBookingDocumentHandler));

adminBookingRouter.use(authenticate, allow(Role.ADMIN));
adminBookingRouter.get("/", asyncHandler(listAdminBookings));
adminBookingRouter.get("/:id", asyncHandler(getAdminBookingDetailHandler));
adminBookingRouter.post("/:id/confirm", asyncHandler(confirmBookingHandler));
adminBookingRouter.post("/:id/depart", asyncHandler(departBookingHandler));
adminBookingRouter.post("/:id/close", asyncHandler(closeBookingHandler));
adminBookingRouter.post("/:id/cancel", asyncHandler(cancelBookingHandler));

driverBookingRouter.post("/:id/deliver", authenticate, allow(Role.DRIVER), asyncHandler(deliverBookingHandler));
