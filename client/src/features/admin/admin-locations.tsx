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
  Report,
} from "@/types/domain";

type AdminLocationsProps = { request: ApiRequest; report: Report };
type StatusFilter = "all" | "active" | "inactive";

function normalize(cityName: string) {
  return cityName.trim().replace(/\s+/g, " ");
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete the location action";
}

export function AdminLocations({ request, report }: AdminLocationsProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [data, setData] = useState<AdminLocationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    location: AdminLocation | null;
    cityName: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<AdminLocation | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const filtersRef = useRef<{ search: string; status: StatusFilter }>({
    search: debouncedSearch,
    status,
  });

  useEffect(() => {
    filtersRef.current = {
      search: debouncedSearch,
      status,
    };
  }, [debouncedSearch, status]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      requestId.current += 1;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLocations = useCallback(
    async (nextSearch: string, nextStatus: StatusFilter) => {
      if (!mounted.current) return;

      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      const currentRequest = ++requestId.current;
      const params = new URLSearchParams({ status: nextStatus });
      if (nextSearch) params.set("search", nextSearch);
      setLoading(true);
      setError(null);
      try {
        const result = await request<AdminLocationListResponse>(
          `/admin/locations?${params.toString()}`,
          { signal: nextController.signal },
        );
        if (mounted.current && currentRequest === requestId.current) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (
          mounted.current &&
          !nextController.signal.aborted &&
          currentRequest === requestId.current
        ) {
          setError(message(cause));
        }
      } finally {
        if (mounted.current && currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    },
    [request],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLocations(debouncedSearch, status);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, loadLocations, status]);

  const refresh = useCallback(() => {
    const filters = filtersRef.current;
    return loadLocations(filters.search, filters.status);
  }, [loadLocations]);

  const save = async () => {
    if (!form || saving) return;
    const cityName = normalize(form.cityName);
    if (cityName.length < 2 || cityName.length > 100) {
      setFormError("City name must be between 2 and 100 characters.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const location = form.location;
      await request<AdminLocation>(
        location ? `/admin/locations/${location.id}` : "/admin/locations",
        {
          method: location ? "PATCH" : "POST",
          body: JSON.stringify({ cityName }),
        },
      );
      if (!mounted.current) return;
      report(location ? "Location updated" : "Location created");
      setForm(null);
      await refresh();
    } catch (cause) {
      if (mounted.current) setFormError(message(cause));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!confirmation || saving) return;
    setSaving(true);
    try {
      await request<AdminLocation>(
        `/admin/locations/${confirmation.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: !confirmation.isActive }),
        },
      );
      if (!mounted.current) return;
      report(`Location ${confirmation.isActive ? "deactivated" : "activated"}`);
      setConfirmation(null);
      await refresh();
    } catch (cause) {
      if (mounted.current) setError(message(cause));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const clear = () => {
    setSearch("");
    setStatus("all");
  };
  const openForm = (location: AdminLocation | null) => {
    setConfirmation(null);
    setForm({ location, cityName: location?.cityName || "" });
    setFormError(null);
  };
  const openConfirmation = (location: AdminLocation) => {
    setForm(null);
    setConfirmation(location);
  };
  const items = data?.items || [];
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
            ADMIN CONTROL CENTRE
          </p>
          <h1 className="mt-2 text-3xl font-bold">Location Master</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage selectable origin and destination cities.
          </p>
        </div>
        <Button onClick={() => openForm(null)}>Add location</Button>
      </section>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            Search city
            <input
              className="h-9 rounded border px-3 font-normal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search locations"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Status
            <select
              className="h-9 rounded border px-3 font-normal"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StatusFilter)
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <Button variant="outline" onClick={clear}>
            Clear filters
          </Button>
          <span className="text-sm text-slate-500">
            {data?.total ?? 0} locations
          </span>
        </CardContent>
      </Card>
      {form && (
        <Card>
          <CardHeader>
            <CardTitle>
              {form.location ? "Edit location" : "Add location"}
            </CardTitle>
            <CardDescription>
              Names are trimmed and repeated spaces are collapsed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="grid gap-1 text-sm font-medium">
              City name
              <input
                autoFocus
                className="h-9 rounded border px-3 font-normal"
                value={form.cityName}
                onChange={(event) =>
                  setForm({ ...form, cityName: event.target.value })
                }
                aria-describedby="location-form-error"
              />
            </label>
            {formError && (
              <p id="location-form-error" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <div className="flex gap-2">
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save location"}
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
      {confirmation && (
        <Card>
          <CardHeader>
            <CardTitle>
              {confirmation.isActive ? "Deactivate" : "Activate"}{" "}
              {confirmation.cityName}?
            </CardTitle>
            <CardDescription>
              Historical routes and bookings will remain available. This does
              not delete the location.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button disabled={saving} onClick={updateStatus}>
              {saving
                ? "Updating…"
                : confirmation.isActive
                  ? "Deactivate location"
                  : "Activate location"}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading locations…</p>
          ) : error ? (
            <p aria-live="polite" className="text-sm text-red-600">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">
              {search || status !== "all"
                ? "No locations match these filters."
                : "No locations have been added yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="p-2">City</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Created</th>
                    <th className="p-2">Updated</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2 font-medium">{item.cityName}</td>
                      <td className="p-2">
                        <Badge>{item.isActive ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className="p-2">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openForm(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openConfirmation(item)}
                          >
                            {item.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
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
