export type Role = "ADMIN" | "CUSTOMER" | "DRIVER";

export type VehicleStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "ON_TRIP"
  | "MAINTENANCE"
  | "BREAKDOWN";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "INVOICED"
  | "CLOSED"
  | "CANCELLED";

export type User = { id: string; name: string; role: Role };

export type Location = { id: string; cityName: string };

export type AdminLocation = {
  id: string;
  cityName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminLocationListResponse = {
  items: AdminLocation[];
  total: number;
};

export type Quote = {
  route: { distanceKm: number; tollAmount: number };
  options: Array<{
    vehicle: {
      id: string;
      regNumber: string;
      vehicleType: string;
      capacityKg: number;
    };
    fare: {
      baseFare: number;
      distanceCharge: number;
      tollAmount: number;
      gstAmount: number;
      total: number;
    };
  }>;
};

export type AuthSession = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  materialDescription: string;
  estimatedFare: number | string;
  lrPdfUrl: string | null;
  invoicePdfUrl: string | null;
  customer: Pick<User, "name">;
  vehicle: { regNumber: string };
  fromLocation: Location;
  toLocation: Location;
};

export type Driver = {
  id: string;
  name: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
};

export type Dashboard = {
  vehicles: Array<{ status: VehicleStatus; _count: number }>;
  revenueThisMonth: number;
  expiringDocuments: Array<{
    id: string;
    regNumber: string;
    rcExpiry: string;
    permitExpiry: string;
  }>;
  recentBookings: Booking[];
};

export type WorkspaceData =
  | { role: "CUSTOMER"; locations: Location[]; bookings: Booking[] }
  | { role: "DRIVER"; bookings: Booking[] }
  | { role: "ADMIN"; dashboard: Dashboard };

export type Report = (message: string) => void;
