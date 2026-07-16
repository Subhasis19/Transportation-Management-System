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

export function isVehicleCompliant(vehicle: { rcExpiry: Date; permitExpiry: Date }) {
    return vehicle.rcExpiry > new Date() && vehicle.permitExpiry > new Date();
}
