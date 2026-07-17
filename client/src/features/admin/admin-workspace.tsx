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
import { AdminLocations } from "@/features/admin/admin-locations";
import { AdminRoutes } from "@/features/admin/admin-routes";
import { currency } from "@/lib/formatters";
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
  const [view, setView] = useState<"overview" | "locations" | "routes">(
    "overview",
  );
  const statusMap = new Map(
    dashboard?.vehicles.map(({ status, _count }) => [status, _count]),
  );
  if (view === "locations") {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("overview")}>
            Overview
          </Button>
          <Button>Locations</Button>
        </div>
        <AdminLocations request={request} report={report} />
      </div>
    );
  }
  if (view === "routes")
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("overview")}>
            Overview
          </Button>
          <Button variant="outline" onClick={() => setView("locations")}>
            Locations
          </Button>
          <Button>Routes</Button>
        </div>
        <AdminRoutes request={request} report={report} />
      </div>
    );
  return (
    <div className="space-y-7">
      <div className="flex gap-2">
        <Button>Overview</Button>
        <Button variant="outline" onClick={() => setView("locations")}>
          Locations
        </Button>
        <Button variant="outline" onClick={() => setView("routes")}>
          Routes
        </Button>
      </div>
      <section>
        <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
          ADMIN CONTROL CENTRE
        </p>
        <h1 className="mt-2 text-3xl font-bold">Operations at a glance</h1>
      </section>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Available", statusMap.get("AVAILABLE") || 0],
          ["Reserved", statusMap.get("RESERVED") || 0],
          ["On trip", statusMap.get("ON_TRIP") || 0],
          ["Revenue this month", currency(dashboard?.revenueThisMonth || 0)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document attention</CardTitle>
            <CardDescription>RC or permit due within 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard?.expiringDocuments?.length ? (
              dashboard.expiringDocuments.map((item) => (
                <p key={item.id} className="rounded bg-amber-50 p-3 text-sm">
                  {item.regNumber} · RC{" "}
                  {new Date(item.rcExpiry).toLocaleDateString()} · Permit{" "}
                  {new Date(item.permitExpiry).toLocaleDateString()}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No upcoming vehicle-document expiries.
              </p>
            )}
          </CardContent>
        </Card>
        <AdminBookings
          bookings={dashboard?.recentBookings || []}
          request={request}
          report={report}
          refresh={refresh}
        />
      </div>
    </div>
  );
}
