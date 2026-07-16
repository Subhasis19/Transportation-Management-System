import type { Response } from "express";
import type { AuthRequest } from "../../lib/auth";
import {
    bookingDocumentParamsSchema,
    bookingIdParamsSchema,
    cancelBookingSchema,
    confirmBookingSchema,
    createBookingSchema,
    deliverBookingSchema,
} from "./booking.schema";
import { createBooking, getBookingDocumentUrl, getBookingsForUser } from "./booking.service";
import { cancelBooking, closeBooking, confirmBooking as confirmBookingLifecycle, departBooking, deliverBooking as deliverBookingLifecycle } from "./booking-lifecycle.service";

export async function createBookingHandler(req: AuthRequest, res: Response) {
    const input = createBookingSchema.parse(req.body);
    res.status(201).json(await createBooking(req.user!.id, input));
}

export async function listMyBookings(req: AuthRequest, res: Response) {
    res.json(await getBookingsForUser(req.user!.id, req.user!.role));
}

export async function confirmBookingHandler(req: AuthRequest, res: Response) {
    const { id } = bookingIdParamsSchema.parse(req.params);
    const { driverId } = confirmBookingSchema.parse(req.body);
    res.json(await confirmBookingLifecycle(id, driverId));
}

export async function departBookingHandler(req: AuthRequest, res: Response) {
    const { id } = bookingIdParamsSchema.parse(req.params);
    res.json(await departBooking(id));
}

export async function deliverBookingHandler(req: AuthRequest, res: Response) {
    const { id } = bookingIdParamsSchema.parse(req.params);
    const { notes } = deliverBookingSchema.parse(req.body);
    res.json(await deliverBookingLifecycle(id, req.user!.id, notes));
}

export async function closeBookingHandler(req: AuthRequest, res: Response) {
    const { id } = bookingIdParamsSchema.parse(req.params);
    res.json(await closeBooking(id));
}

export async function cancelBookingHandler(req: AuthRequest, res: Response) {
    const { id } = bookingIdParamsSchema.parse(req.params);
    const { reason } = cancelBookingSchema.parse(req.body);
    res.json(await cancelBooking(id, reason));
}

export async function getBookingDocumentHandler(req: AuthRequest, res: Response) {
    const { id, kind } = bookingDocumentParamsSchema.parse(req.params);
    res.json(await getBookingDocumentUrl(id, kind, req.user!.id, req.user!.role));
}
