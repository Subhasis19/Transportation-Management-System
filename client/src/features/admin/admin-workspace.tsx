import { useState, type ReactNode } from "react";
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

type AdminView =
  | "overview"
  | "locations"
  | "routes"
  | "pricing"
  | "vehicles"
  | "drivers"
  | "users"
  | "bookings";

type AdminWorkspaceProps = {
  dashboard: Dashboard | null;
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
};

const navigationItems: ReadonlyArray<readonly [AdminView, string]> = [
  ["overview", "Overview"],
  ["locations", "Locations"],
  ["routes", "Routes"],
  ["pricing", "Pricing"],
  ["vehicles", "Vehicles"],
  ["drivers", "Drivers"],
  ["users", "Users"],
  ["bookings", "Bookings"],
];

export function AdminWorkspace({
  dashboard,
  request,
  report,
  refresh,
}: AdminWorkspaceProps) {
  const [view, setView] = useState<AdminView>("overview");
  let content: ReactNode;

  if (view === "locations") {
    content = <AdminLocations request={request} report={report} />;
  } else if (view === "routes") {
    content = <AdminRoutes request={request} report={report} />;
  } else if (view === "pricing") {
    content = <AdminPricing request={request} report={report} />;
  } else if (view === "vehicles") {
    content = <AdminVehicles request={request} report={report} />;
  } else if (view === "drivers") {
    content = <AdminDrivers request={request} report={report} />;
  } else if (view === "users") {
    content = <AdminUsers request={request} report={report} />;
  } else if (view === "bookings") {
    content = (
      <AdminBookingOperations
        request={request}
        report={report}
        refreshDashboard={refresh}
      />
    );
  } else {
    content = (
      <AdminOverviewDashboard
        dashboard={dashboard}
        request={request}
        report={report}
        refreshDashboard={refresh}
        onNavigate={setView}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col gap-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="shrink-0 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border bg-card p-3">
          <p className="px-3 pb-3 text-sm font-semibold text-muted-foreground">
            Admin panel
          </p>
          <nav
            aria-label="Admin navigation"
            className="flex w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {navigationItems.map(([target, label]) => (
              <Button
                key={target}
                className="shrink-0 justify-start lg:w-full"
                variant={view === target ? "default" : "outline"}
                onClick={() => setView(target)}
              >
                {label}
              </Button>
            ))}
          </nav>
        </div>
      </aside>
      <section className="min-w-0 w-full">{content}</section>
    </div>
  );
}
