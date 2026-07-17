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

export type AdminRouteLocation = Pick<
  AdminLocation,
  "id" | "cityName" | "isActive"
>;

export type AdminRoute = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  fromLocation: AdminRouteLocation;
  toLocation: AdminRouteLocation;
  distanceKm: number;
  tollAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminRouteListResponse = {
  items: AdminRoute[];
  total: number;
};

export type VehicleType =
  | "MINI_TRUCK"
  | "LIGHT_TRUCK"
  | "MEDIUM_TRUCK"
  | "HEAVY_TRUCK";

export type AdminRateCard = {
  id: string;
  vehicleType: VehicleType;
  baseFare: number;
  perKmRate: number;
  gstPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type VehicleDocumentStatus = "VALID" | "EXPIRING" | "EXPIRED";

export type AdminVehicleActiveBooking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "IN_TRANSIT" | "INVOICED";
};

export type AdminVehicle = {
  id: string;
  regNumber: string;
  vehicleType: VehicleType;
  capacityKg: number;
  status: VehicleStatus;
  rcNumber: string;
  rcExpiry: string;
  permitNumber: string;
  permitExpiry: string;
  documentStatus: VehicleDocumentStatus;
  activeBooking: AdminVehicleActiveBooking | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminVehicleListResponse = {
  items: AdminVehicle[];
  total: number;
  page: number;
  limit: number;
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

export type DriverLicenseStatus = "VALID" | "EXPIRING" | "EXPIRED" | "MISSING";

export type AdminDriverActiveAssignment = {
  id: string;
  status: "CONFIRMED" | "IN_TRANSIT";
  vehicle: {
    id: string;
    regNumber: string;
  };
  fromLocation: Location;
  toLocation: Location;
};

export type AdminDriver = {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  licenseStatus: DriverLicenseStatus;
  isActive: boolean;
  activeAssignment: AdminDriverActiveAssignment | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminDriverListResponse = {
  items: AdminDriver[];
  total: number;
  page: number;
  limit: number;
};

export type DriverOption = {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
};

export type CreateDriverResponse = {
  driver: AdminDriver;
  temporaryPassword: string;
};

export type UserActivityStatus = "RECENT" | "STALE" | "NEVER";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  activityStatus: UserActivityStatus;
  lastLoginAt: string | null;
  customerBookingCount: number;
  driverAssignmentCount: number;
  isCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

export type AdminUserRecentBooking = {
  id: string;
  relationship: "CUSTOMER" | "DRIVER";
  status: BookingStatus;
  estimatedFare: number;
  pickupAt: string;
  createdAt: string;
  vehicle: {
    id: string;
    regNumber: string;
  };
  fromLocation: Location;
  toLocation: Location;
};

export type AdminUserDetail = AdminUser & {
  licenseNumber: string | null;
  licenseExpiry: string | null;
  totalRelevantBookings: number;
  recentBookings: AdminUserRecentBooking[];
};

export type AdminBookingListItem = {
  id: string;
  status: BookingStatus;
  pickupAt: string;
  materialDescription: string;
  weightKg: number;
  estimatedFare: number;
  customer: { id: string; name: string; email: string; phone: string };
  driver: { id: string; name: string } | null;
  vehicle: {
    id: string;
    regNumber: string;
    vehicleType: string;
    status: VehicleStatus;
  };
  fromLocation: Location;
  toLocation: Location;
  lrNumber: string | null;
  invoiceNumber: string | null;
  hasLrDocument: boolean;
  hasInvoiceDocument: boolean;
  createdAt: string;
  updatedAt: string;
};
export type AdminBookingListResponse = {
  items: AdminBookingListItem[];
  total: number;
  page: number;
  limit: number;
};
export type AdminBookingDetail = AdminBookingListItem & {
  viaRoute: string | null;
  consignorName: string;
  consigneeName: string;
  declaredValue: number;
  distanceKm: number;
  baseFare: number;
  distanceCharge: number;
  tollAmount: number;
  gstPercent: number;
  gstAmount: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  lrGeneratedAt: string | null;
  deliveryTime: string | null;
  deliveryNotes: string | null;
  invoiceGeneratedAt: string | null;
  customer: AdminBookingListItem["customer"] & { isActive: boolean };
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string;
    licenseNumber: string | null;
    licenseExpiry: string | null;
    isActive: boolean;
  } | null;
  vehicle: AdminBookingListItem["vehicle"] & {
    capacityKg: number;
    rcExpiry: string;
    permitExpiry: string;
  };
};
export type BookingDocumentResponse = { url: string };

export type DashboardVehicleDocumentAlert = {
  id: string;
  regNumber: string;
  status: VehicleStatus;
  rcExpiry: string;
  permitExpiry: string;
  documentStatus: "EXPIRING" | "EXPIRED";
};
export type DashboardDriverLicenseAlert = {
  id: string;
  name: string;
  isActive: boolean;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  licenseStatus: "EXPIRING" | "EXPIRED" | "MISSING";
};
export type DashboardRecentBooking = {
  id: string;
  status: BookingStatus;
  materialDescription: string;
  estimatedFare: number;
  pickupAt: string;
  createdAt: string;
  customer: { id: string; name: string };
  driver: { id: string; name: string } | null;
  vehicle: { id: string; regNumber: string };
  fromLocation: Location;
  toLocation: Location;
};
export type Dashboard = {
  generatedAt: string;
  users: {
    customers: number;
    enabledAccounts: number;
    recentlyActiveAccounts: number;
  };
  drivers: { total: number; enabled: number; eligibleForAssignment: number };
  vehicles: {
    total: number;
    available: number;
    quoteReady: number;
    reserved: number;
    onTrip: number;
    maintenance: number;
    breakdown: number;
  };
  bookings: {
    total: number;
    pending: number;
    active: number;
    confirmed: number;
    inTransit: number;
    delivered: number;
    invoiced: number;
    closed: number;
    cancelled: number;
  };
  monthlyBookingValue: number;
  vehicleDocumentAlerts: DashboardVehicleDocumentAlert[];
  driverLicenseAlerts: DashboardDriverLicenseAlert[];
  recentBookings: DashboardRecentBooking[];
};

export type WorkspaceData =
  | { role: "CUSTOMER"; locations: Location[]; bookings: Booking[] }
  | { role: "DRIVER"; bookings: Booking[] }
  | { role: "ADMIN"; dashboard: Dashboard };

export type Report = (message: string) => void;
