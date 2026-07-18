export const bookingInclude = {
    customer: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    driver: {
        select: {
            id: true,
            name: true,
        },
    },
    vehicle: true,
    fromLocation: true,
    toLocation: true,
} as const;

type BookingDocumentFields = {
    id: string;
    lrPdfUrl: string | null;
    invoicePdfUrl: string | null;
};

export function toBookingResponse<T extends BookingDocumentFields>(booking: T) {
    return {
        ...booking,
        lrPdfUrl: booking.lrPdfUrl
            ? `/bookings/${booking.id}/documents/lr`
            : null,
        invoicePdfUrl: booking.invoicePdfUrl
            ? `/bookings/${booking.id}/documents/invoice`
            : null,
    };
}

export function isVehicleCompliant(vehicle: { rcExpiry: Date; permitExpiry: Date }) {
    return vehicle.rcExpiry > new Date() && vehicle.permitExpiry > new Date();
}
