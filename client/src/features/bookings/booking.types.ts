import { z } from "zod";
import { bookingSchema } from "./booking.schema";

export type BookingFormInput = z.input<typeof bookingSchema>;
export type BookingFormValues = z.infer<typeof bookingSchema>;
