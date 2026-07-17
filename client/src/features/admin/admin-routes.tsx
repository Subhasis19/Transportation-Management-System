import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type {
  AdminLocation,
  AdminLocationListResponse,
  AdminRoute,
  AdminRouteListResponse,
  Report,
} from "@/types/domain";

type Props = { request: ApiRequest; report: Report };
type Status = "all" | "active" | "inactive";
type Form = {
  route: AdminRoute | null;
  fromLocationId: string;
  toLocationId: string;
  distanceKm: string;
  tollAmount: string;
};
const blank = (): Form => ({
  route: null,
  fromLocationId: "",
  toLocationId: "",
  distanceKm: "",
  tollAmount: "",
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete route action";
const validNumber = (value: string, minimum: number, maximum: number) => {
  if (value.trim() === "") return false;
  const number = Number(value);
  return (
    Number.isFinite(number) &&
    number >= minimum &&
    number <= maximum &&
    Math.abs(number * 100 - Math.round(number * 100)) <=
      Number.EPSILON * Math.max(1, Math.abs(number * 100)) * 8
  );
};

export function AdminRoutes({ request, report }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [data, setData] = useState<AdminRouteListResponse | null>(null);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminRoute | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(
    null,
  );
  const mounted = useRef(true);
  const routeId = useRef(0);
  const locationId = useRef(0);
  const routeController = useRef<AbortController | null>(null);
  const locationController = useRef<AbortController | null>(null);
  const filters = useRef({ search: "", status: "all" as Status });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      routeId.current += 1;
      locationId.current += 1;
      routeController.current?.abort();
      locationController.current?.abort();
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const loadRoutes = useCallback(
    async (nextSearch: string, nextStatus: Status) => {
      if (!mounted.current) return;
      filters.current = { search: nextSearch, status: nextStatus };
      routeController.current?.abort();
      const controller = new AbortController();
      routeController.current = controller;
      const id = ++routeId.current;
      const params = new URLSearchParams({ status: nextStatus });
      if (nextSearch) params.set("search", nextSearch);
      setLoading(true);
      setRouteError(null);
      try {
        const result = await request<AdminRouteListResponse>(
          `/admin/routes?${params}`,
          { signal: controller.signal },
        );
        if (mounted.current && id === routeId.current) {
          setData(result);
          setRouteError(null);
        }
      } catch (error) {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          id === routeId.current
        )
          setRouteError(errorText(error));
      } finally {
        if (mounted.current && id === routeId.current) setLoading(false);
      }
    },
    [request],
  );
  const refresh = useCallback(
    () => loadRoutes(filters.current.search, filters.current.status),
    [loadRoutes],
  );
  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadRoutes(debouncedSearch, status),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, loadRoutes, status]);
  useEffect(() => {
    if (!mounted.current) return;
    const controller = new AbortController();
    locationController.current?.abort();
    locationController.current = controller;
    const id = ++locationId.current;
    setLocationLoading(true);
    setLocationError(null);
    void request<AdminLocationListResponse>("/admin/locations?status=active", {
      signal: controller.signal,
    })
      .then((result) => {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          id === locationId.current
        ) {
          setLocations(result.items);
          setLocationError(null);
        }
      })
      .catch((error: unknown) => {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          id === locationId.current
        ) {
          setLocationError(errorText(error));
        }
      })
      .finally(() => {
        if (mounted.current && id === locationId.current) {
          setLocationLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, [request]);
  const options = form?.route
    ? [
        ...locations,
        ...[form.route.fromLocation, form.route.toLocation].filter(
          (location) => !locations.some((item) => item.id === location.id),
        ),
      ]
    : locations;
  const openForm = (route: AdminRoute | null) => {
    if (saving) return;
    setConfirming(null);
    setStatusActionError(null);
    setForm(
      route
        ? {
            route,
            fromLocationId: route.fromLocationId,
            toLocationId: route.toLocationId,
            distanceKm: String(route.distanceKm),
            tollAmount: String(route.tollAmount),
          }
        : blank(),
    );
    setFormError(null);
  };
  const save = async () => {
    if (!form || saving || locationError || locationLoading) return;
    if (
      !form.fromLocationId ||
      !form.toLocationId ||
      form.fromLocationId === form.toLocationId
    )
      return setFormError("Choose two different locations.");
    if (
      !validNumber(form.distanceKm, 0.01, 99999) ||
      !validNumber(form.tollAmount, 0, 99999999)
    )
      return setFormError(
        "Distance and toll must be valid amounts with at most two decimals.",
      );
    setSaving(true);
    try {
      const body = JSON.stringify({
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        distanceKm: Number(form.distanceKm),
        tollAmount: Number(form.tollAmount),
      });
      await request<AdminRoute>(
        form.route ? `/admin/routes/${form.route.id}` : "/admin/routes",
        { method: form.route ? "PATCH" : "POST", body },
      );
      if (!mounted.current) return;
      report(form.route ? "Route updated" : "Route created");
      setForm(null);
      await refresh();
    } catch (error) {
      if (mounted.current) setFormError(errorText(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  const changeStatus = async () => {
    if (!confirming || saving) return;
    setStatusActionError(null);
    setSaving(true);
    try {
      await request<AdminRoute>(`/admin/routes/${confirming.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !confirming.isActive }),
      });
      if (!mounted.current) return;
      report(`Route ${confirming.isActive ? "deactivated" : "activated"}`);
      setConfirming(null);
      setStatusActionError(null);
      await refresh();
    } catch (error) {
      if (mounted.current) setStatusActionError(errorText(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
            ADMIN CONTROL CENTRE
          </p>
          <h1 className="mt-2 text-3xl font-bold">Route Master</h1>
        </div>
        <Button
          disabled={
            locationLoading ||
            locations.length < 2 ||
            !!locationError ||
            saving
          }
          onClick={() => openForm(null)}
        >
          Add route
        </Button>
      </section>
      {locationError && (
        <p aria-live="polite" className="text-sm text-red-600">
          Unable to load active locations: {locationError}
        </p>
      )}
      {locationLoading && (
        <p aria-live="polite" className="text-sm text-slate-500">
          Loading active locations…
        </p>
      )}
      {locations.length < 2 && !locationLoading && !locationError && (
        <p className="text-sm text-amber-700">
          At least two active locations are required to create a route.
        </p>
      )}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <label className="grid flex-1 gap-1 text-sm">
            Search routes
            <input
              className="h-9 rounded border px-3"
              aria-label="Search routes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search origin or destination"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Status
            <select
              className="h-9 rounded border px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value as Status)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setStatus("all");
            }}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>
      {form && (
        <Card>
          <CardHeader>
            <CardTitle>{form.route ? "Edit route" : "Add route"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Origin
              <select
                aria-describedby={formError ? "route-form-error" : undefined}
                value={form.fromLocationId}
                onChange={(event) =>
                  setForm({ ...form, fromLocationId: event.target.value })
                }
              >
                <option value="">Origin</option>
                {options.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.cityName}
                    {!location.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Destination
              <select
                aria-describedby={formError ? "route-form-error" : undefined}
                value={form.toLocationId}
                onChange={(event) =>
                  setForm({ ...form, toLocationId: event.target.value })
                }
              >
                <option value="">Destination</option>
                {options.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.cityName}
                    {!location.isActive ? " (Inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Distance in kilometres
              <input
                aria-describedby={formError ? "route-form-error" : undefined}
                type="number"
                step="0.01"
                placeholder="Distance in kilometres"
                value={form.distanceKm}
                onChange={(event) =>
                  setForm({ ...form, distanceKm: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Toll amount
              <input
                aria-describedby={formError ? "route-form-error" : undefined}
                type="number"
                step="0.01"
                placeholder="Toll amount"
                value={form.tollAmount}
                onChange={(event) =>
                  setForm({ ...form, tollAmount: event.target.value })
                }
              />
            </label>
            {formError && (
              <p id="route-form-error" aria-live="polite" className="text-red-600">
                {formError}
              </p>
            )}
            <div>
              <Button
                disabled={saving || locationLoading || !!locationError}
                onClick={save}
              >
                {saving ? "Saving…" : "Save route"}
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setForm(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {confirming && (
        <Card>
          <CardHeader>
            <CardTitle>
              {confirming.isActive ? "Deactivate" : "Activate"}{" "}
              {confirming.fromLocation.cityName} →{" "}
              {confirming.toLocation.cityName}?
            </CardTitle>
            <CardDescription>
              {confirming.isActive
                ? "New quotes and bookings will not use this route. Historical bookings remain unchanged; the route is not deleted."
                : "Both endpoint locations must be active before this route becomes available."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusActionError && (
              <p aria-live="polite" className="mb-3 text-red-600">
                {statusActionError}
              </p>
            )}
            <Button disabled={saving} onClick={changeStatus}>
              {saving
                ? "Updating…"
                : confirming.isActive
                  ? "Deactivate route"
                  : "Activate route"}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setConfirming(null);
                setStatusActionError(null);
              }}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{data?.total ?? 0} routes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading routes…</p>
          ) : routeError ? (
            <p aria-live="polite" className="text-red-600">
              {routeError}
            </p>
          ) : !data || data.items.length === 0 ? (
            <p>
              {search || status !== "all"
                ? "No routes match these filters."
                : "No routes have been configured yet."}
            </p>
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
                    <th>Endpoint availability</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((route) => (
                    <tr key={route.id} className="border-t">
                      <td>{route.fromLocation.cityName}</td>
                      <td>{route.toLocation.cityName}</td>
                      <td>{route.distanceKm}</td>
                      <td>{route.tollAmount}</td>
                      <td>
                        <Badge>{route.isActive ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td>
                        Origin:{" "}
                        {route.fromLocation.isActive ? "Active" : "Inactive"};
                        Destination:{" "}
                        {route.toLocation.isActive ? "Active" : "Inactive"}
                      </td>
                      <td>{new Date(route.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => openForm(route)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            if (saving) return;
                            setForm(null);
                            setStatusActionError(null);
                            setConfirming(route);
                          }}
                        >
                          {route.isActive ? "Deactivate" : "Activate"}
                        </Button>
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
