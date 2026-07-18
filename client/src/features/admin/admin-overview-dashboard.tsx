import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminBookings } from "@/features/admin/admin-bookings";
import { currency } from "@/lib/formatters";
import type { ApiRequest } from "@/lib/api-client";
import type { Dashboard, Report } from "@/types/domain";
type Props = {
  dashboard: Dashboard | null;
  request: ApiRequest;
  report: Report;
  refreshDashboard: () => Promise<void>;
  onNavigate: (view: "drivers" | "vehicles" | "bookings") => void;
};
export function AdminOverviewDashboard({
  dashboard,
  request,
  report,
  refreshDashboard,
  onNavigate,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshDashboard();
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Unable to refresh dashboard",
      );
    } finally {
      setRefreshing(false);
    }
  };
  if (!dashboard)
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p>Loading admin overview…</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry dashboard
          </Button>
        </CardContent>
      </Card>
    );
  const cards = [
    ["Total Active Customers", dashboard.users.activeCustomers, ""],
    [
      "Recently Active",
      dashboard.users.recentlyActiveAccounts,
      "Enabled accounts active in the last 30 days",
    ],
    [
      "Drivers",
      dashboard.drivers.total,
      `${dashboard.drivers.enabled} enabled · ${dashboard.drivers.eligibleForAssignment} assignment-ready`,
    ],
    ["Total Vehicles", dashboard.vehicles.total, ""],
    [
      "Quote-ready Vehicles",
      dashboard.vehicles.quoteReady,
      "Available with valid RC and permit",
    ],
    ["Pending Bookings", dashboard.bookings.pending, ""],
    [
      "Invoiced Bookings",
      dashboard.bookings.invoiced,
      "Bookings with completed delivery and invoicing",
    ],
    ["Active Bookings", dashboard.bookings.active, ""],
    [
      "Monthly Booking Value",
      currency(dashboard.monthlyBookingValue),
      "Estimated value of non-cancelled bookings created this month. This is not collected revenue.",
    ],
  ];
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
            ADMIN CONTROL CENTRE
          </p>
          <h1 className="mt-2 text-3xl font-bold">Operations at a glance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor users, fleet readiness, bookings and compliance alerts.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? "Refreshing…" : "Refresh dashboard"}
        </Button>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, note]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-foreground/80">
                {label}
              </CardDescription>
              <CardTitle>{value}</CardTitle>
              {note && <CardDescription>{note}</CardDescription>}
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Truck status</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Available", dashboard.vehicles.available],
              ["Quote-ready", dashboard.vehicles.quoteReady],
              ["Reserved", dashboard.vehicles.reserved],
              ["On Trip", dashboard.vehicles.onTrip],
              ["Maintenance", dashboard.vehicles.maintenance],
              ["Breakdown", dashboard.vehicles.breakdown],
            ].map(([label, value]) => (
              <p key={String(label)}>
                <b>{label}:</b> {value}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Booking pipeline</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Pending", dashboard.bookings.pending],
              ["Confirmed", dashboard.bookings.confirmed],
              ["In Transit", dashboard.bookings.inTransit],
              ["Delivered", dashboard.bookings.delivered],
              ["Invoiced", dashboard.bookings.invoiced],
              ["Closed", dashboard.bookings.closed],
              ["Cancelled", dashboard.bookings.cancelled],
              ["Total bookings", dashboard.bookings.total],
            ].map(([label, value]) => (
              <p key={String(label)}>
                <b>{label}:</b> {value}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vehicle document attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {dashboard.vehicleDocumentAlerts.length ? (
              dashboard.vehicleDocumentAlerts.map((item) => (
                <p key={item.id}>
                  {item.regNumber} · {item.status} · RC{" "}
                  {new Date(item.rcExpiry).toLocaleDateString()} · Permit{" "}
                  {new Date(item.permitExpiry).toLocaleDateString()} ·{" "}
                  {item.documentStatus === "EXPIRING"
                    ? "Expiring Soon"
                    : "Expired"}
                </p>
              ))
            ) : (
              <p>No vehicle documents require attention.</p>
            )}
            <Button variant="outline" onClick={() => onNavigate("vehicles")}>
              Manage vehicles
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Driver licence attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {dashboard.driverLicenseAlerts.length ? (
              dashboard.driverLicenseAlerts.map((item) => (
                <p key={item.id}>
                  {item.name} · {item.isActive ? "Active" : "Inactive"} ·{" "}
                  {item.licenseNumber || "Missing"} ·{" "}
                  {item.licenseExpiry
                    ? new Date(item.licenseExpiry).toLocaleDateString()
                    : "Missing"}{" "}
                  ·{" "}
                  {item.licenseStatus === "EXPIRING"
                    ? "Expiring Soon"
                    : item.licenseStatus === "EXPIRED"
                      ? "Expired"
                      : "Missing"}
                </p>
              ))
            ) : (
              <p>No driver licences require attention.</p>
            )}
            <Button variant="outline" onClick={() => onNavigate("drivers")}>
              Manage drivers
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminBookings
          bookings={dashboard.recentBookings}
          request={request}
          report={report}
          refresh={refreshDashboard}
        />
        <Card>
          <CardHeader>
            <CardTitle>Recent bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              {dashboard.recentBookings.length
                ? "Use the compact card to perform permitted recent-booking actions."
                : "No bookings have been created."}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => onNavigate("bookings")}
            >
              Open all bookings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
