import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type { AdminRouteListResponse, Report } from "@/types/domain";

export function AdminRoutes({
  request,
  report,
}: {
  request: ApiRequest;
  report: Report;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState<AdminRouteListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ status });
      if (search) params.set("search", search);
      void request<AdminRouteListResponse>(`/admin/routes?${params}`, {
        signal: controller.signal,
      })
        .then(setData)
        .catch((cause: unknown) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof Error ? cause.message : "Unable to load routes",
            );
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [request, search, status]);
  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between">
        <div>
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
            ADMIN CONTROL CENTRE
          </p>
          <h1 className="mt-2 text-3xl font-bold">Route Master</h1>
        </div>
        <Button
          onClick={() =>
            report("Route creation is available through the Route Master API")
          }
        >
          Add route
        </Button>
      </section>
      <Card>
        <CardContent className="flex gap-3 pt-6">
          <label className="grid flex-1 gap-1 text-sm">
            Search routes
            <input
              className="h-9 rounded border px-3"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Status
            <select
              className="h-9 rounded border px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{data?.total ?? 0} routes</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p aria-live="polite" className="text-red-600">
              {error}
            </p>
          ) : !data ? (
            <p>Loading routes…</p>
          ) : data.items.length === 0 ? (
            <p>No routes match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Distance</th>
                    <th>Toll</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((route) => (
                    <tr key={route.id} className="border-t">
                      <td>
                        {route.fromLocation.cityName}
                        {!route.fromLocation.isActive && " (inactive location)"}
                      </td>
                      <td>
                        {route.toLocation.cityName}
                        {!route.toLocation.isActive && " (inactive location)"}
                      </td>
                      <td>{route.distanceKm}</td>
                      <td>{route.tollAmount}</td>
                      <td>
                        <Badge>{route.isActive ? "Active" : "Inactive"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
