import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminLocations } from "@/features/admin/admin-locations";
import { AdminPricing } from "@/features/admin/admin-pricing";
import { AdminRoutes } from "@/features/admin/admin-routes";
import { AdminVehicles } from "@/features/admin/admin-vehicles";
import { AdminDrivers } from "@/features/admin/admin-drivers";
import { AdminUsers } from "@/features/admin/admin-users";
import { AdminBookingOperations } from "@/features/admin/admin-booking-operations";
import { AdminOverviewDashboard } from "@/features/admin/admin-overview-dashboard";
import type { ApiRequest } from "@/lib/api-client";
import type { Dashboard, Report } from "@/types/domain";

type AdminWorkspaceProps = {
  dashboard: Dashboard | null;
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
};

export function AdminWorkspace({
  dashboard,
  request,
  report,
  refresh,
}: AdminWorkspaceProps) {
  const [view, setView] = useState<
    | "overview"
    | "locations"
    | "routes"
    | "pricing"
    | "vehicles"
    | "drivers"
    | "users"
    | "bookings"
  >("overview");
  const navigation = (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["overview", "Overview"],
          ["locations", "Locations"],
          ["routes", "Routes"],
          ["pricing", "Pricing"],
          ["vehicles", "Vehicles"],
          ["drivers", "Drivers"],
          ["users", "Users"],
          ["bookings", "Bookings"],
        ] as const
      ).map(([target, label]) => (
        <Button
          key={target}
          variant={view === target ? "default" : "outline"}
          onClick={() => setView(target)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
  if (view === "locations") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminLocations request={request} report={report} />
      </div>
    );
  }
  if (view === "routes") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminRoutes request={request} report={report} />
      </div>
    );
  }
  if (view === "pricing") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminPricing request={request} report={report} />
      </div>
    );
  }
  if (view === "vehicles") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminVehicles request={request} report={report} />
      </div>
    );
  }
  if (view === "drivers") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminDrivers request={request} report={report} />
      </div>
    );
  }
  if (view === "users") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminUsers request={request} report={report} />
      </div>
    );
  }
  if (view === "bookings") {
    return (
      <div className="space-y-4">
        {navigation}
        <AdminBookingOperations
          request={request}
          report={report}
          refreshDashboard={refresh}
        />
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {navigation}
      <AdminOverviewDashboard
        dashboard={dashboard}
        request={request}
        report={report}
        refreshDashboard={refresh}
        onNavigate={setView}
      />
    </div>
  );
}
