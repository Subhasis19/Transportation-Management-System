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
  AdminDriver,
  AdminDriverListResponse,
  CreateDriverResponse,
  DriverLicenseStatus,
  Report,
} from "@/types/domain";

type AdminDriversProps = { request: ApiRequest; report: Report };
type AccountStatusFilter = "all" | "active" | "inactive";
type LicenseStatusFilter = "all" | DriverLicenseStatus;
type Filters = {
  search: string;
  status: AccountStatusFilter;
  licenseStatus: LicenseStatusFilter;
  page: number;
};
type DriverForm = {
  driver: AdminDriver | null;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
};
type Confirmation = { driver: AdminDriver; isActive: boolean };
type TemporaryPassword = {
  name: string;
  email: string;
  password: string;
};

const licenseLabels: Record<DriverLicenseStatus, string> = {
  VALID: "Valid",
  EXPIRING: "Expiring Soon",
  EXPIRED: "Expired",
  MISSING: "Missing",
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete the driver action";
const dateValue = (value: string | null) => value?.slice(0, 10) || "";
const emptyForm = (): DriverForm => ({
  driver: null,
  name: "",
  email: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
});
const validFutureDate = (value: string) => {
  if (!value) return false;
  const expiry = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(expiry.getTime()) && expiry > today;
};
const validDate = (value: string) =>
  Boolean(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export function AdminDrivers({ request, report }: AdminDriversProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<AccountStatusFilter>("all");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminDriverListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] =
    useState<TemporaryPassword | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const filtersRef = useRef<Filters>({
    search: "",
    status: "all",
    licenseStatus: "all",
    page: 1,
  });

  useEffect(() => {
    filtersRef.current = {
      search: debouncedSearch,
      status,
      licenseStatus,
      page,
    };
  }, [debouncedSearch, status, licenseStatus, page]);

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

  const loadDrivers = useCallback(
    async (filters: Filters) => {
      if (!mounted.current) return;
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      const currentRequest = ++requestId.current;
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: "10",
        status: filters.status,
        licenseStatus: filters.licenseStatus,
      });
      if (filters.search) params.set("search", filters.search);
      setLoading(true);
      setLoadError(null);
      try {
        const result = await request<AdminDriverListResponse>(
          `/admin/drivers?${params}`,
          { signal: nextController.signal },
        );
        if (mounted.current && currentRequest === requestId.current) {
          setData(result);
          setLoadError(null);
        }
      } catch (error) {
        if (
          mounted.current &&
          !nextController.signal.aborted &&
          currentRequest === requestId.current
        ) {
          setLoadError(errorMessage(error));
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
    const timer = window.setTimeout(
      () => void loadDrivers(filtersRef.current),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, status, licenseStatus, page, loadDrivers]);

  const refresh = useCallback(
    () => loadDrivers(filtersRef.current),
    [loadDrivers],
  );

  const openForm = (driver: AdminDriver | null) => {
    if (saving) return;
    setConfirmation(null);
    setStatusError(null);
    setFormError(null);
    setForm(
      driver
        ? {
            driver,
            name: driver.name,
            email: driver.email,
            phone: driver.phone,
            licenseNumber: driver.licenseNumber || "",
            licenseExpiry: dateValue(driver.licenseExpiry),
          }
        : emptyForm(),
    );
  };

  const save = async () => {
    if (!form || saving) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const licenseNumber = form.licenseNumber.trim().toUpperCase();
    if (
      name.length < 2 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !/^\+?[0-9]{10,15}$/.test(phone) ||
      licenseNumber.length < 3 ||
      !validDate(form.licenseExpiry) ||
      (!form.driver && !validFutureDate(form.licenseExpiry))
    ) {
      setFormError("Enter valid driver, contact and licence details.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = JSON.stringify({
        name,
        email,
        phone,
        licenseNumber,
        licenseExpiry: form.licenseExpiry,
      });
      if (form.driver) {
        await request<AdminDriver>(`/admin/drivers/${form.driver.id}`, {
          method: "PATCH",
          body,
        });
        if (!mounted.current) return;
        report("Driver updated");
        setForm(null);
        await refresh();
      } else {
        const result = await request<CreateDriverResponse>("/admin/drivers", {
          method: "POST",
          body,
        });
        if (!mounted.current) return;
        report("Driver created");
        setForm(null);
        setTemporaryPassword({
          name: result.driver.name,
          email: result.driver.email,
          password: result.temporaryPassword,
        });
        await refresh();
      }
    } catch (error) {
      if (mounted.current) setFormError(errorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const openConfirmation = (driver: AdminDriver) => {
    if (saving) return;
    setForm(null);
    setFormError(null);
    setStatusError(null);
    setConfirmation({ driver, isActive: !driver.isActive });
  };

  const updateStatus = async () => {
    if (!confirmation || saving) return;
    setSaving(true);
    setStatusError(null);
    try {
      await request<AdminDriver>(
        `/admin/drivers/${confirmation.driver.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: confirmation.isActive }),
        },
      );
      if (!mounted.current) return;
      report("Driver status updated");
      setConfirmation(null);
      await refresh();
    } catch (error) {
      if (mounted.current) setStatusError(errorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(temporaryPassword.password);
    } catch {
      if (mounted.current) {
        setCopyError("Unable to copy automatically. The password remains visible.");
      }
    }
  };

  const setFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
            ADMIN CONTROL CENTRE
          </p>
          <h1 className="mt-2 text-3xl font-bold">Driver Onboarding</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage driver accounts, licences and assignment availability.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Drivers with active trips cannot be deactivated.
          </p>
        </div>
        <Button disabled={saving} onClick={() => openForm(null)}>
          Add driver
        </Button>
      </section>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Search
            <input
              className="h-9 rounded border px-3 font-normal"
              placeholder="Search name, email, phone or licence"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Account status
            <select
              className="h-9 rounded border px-3 font-normal"
              value={status}
              onChange={(event) =>
                setFilter(
                  setStatus,
                  event.target.value as AccountStatusFilter,
                )
              }
            >
              <option value="all">All drivers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Licence status
            <select
              className="h-9 rounded border px-3 font-normal"
              value={licenseStatus}
              onChange={(event) =>
                setFilter(
                  setLicenseStatus,
                  event.target.value as LicenseStatusFilter,
                )
              }
            >
              <option value="all">All licences</option>
              <option value="VALID">Valid</option>
              <option value="EXPIRING">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="MISSING">Missing</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setLicenseStatus("all");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {form && (
        <Card>
          <CardHeader>
            <CardTitle>{form.driver ? "Edit driver" : "Add driver"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Full name
              <input
                className="h-9 rounded border px-3 font-normal"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Email
              <input
                className="h-9 rounded border px-3 font-normal"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Phone
              <input
                className="h-9 rounded border px-3 font-normal"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Licence number
              <input
                className="h-9 rounded border px-3 font-normal"
                value={form.licenseNumber}
                onChange={(event) =>
                  setForm({ ...form, licenseNumber: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Licence expiry date
              <input
                className="h-9 rounded border px-3 font-normal"
                type="date"
                value={form.licenseExpiry}
                onChange={(event) =>
                  setForm({ ...form, licenseExpiry: event.target.value })
                }
              />
            </label>
            {formError && (
              <p
                aria-live="polite"
                className="text-sm text-red-600 md:col-span-2"
              >
                {formError}
              </p>
            )}
            <div className="flex gap-2 md:col-span-2">
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save driver"}
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

      {temporaryPassword && (
        <Card>
          <CardHeader>
            <CardTitle>Driver account created</CardTitle>
            <CardDescription>
              Warning: This password is shown only once. Copy it before closing
              this message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Driver: <b>{temporaryPassword.name}</b>
            </p>
            <p>
              Login email: <b>{temporaryPassword.email}</b>
            </p>
            <p>
              Temporary password: <b>{temporaryPassword.password}</b>
            </p>
            {copyError && (
              <p aria-live="polite" className="text-red-600">
                {copyError}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void copyPassword()}>Copy password</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTemporaryPassword(null);
                  setCopyError(null);
                }}
              >
                I saved it
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {confirmation && (
        <Card>
          <CardHeader>
            <CardTitle>{confirmation.isActive ? "Activate driver" : "Deactivate driver"}</CardTitle>
            <CardDescription>
              {confirmation.isActive
                ? "A valid, non-expired licence is required before activation."
                : "The driver will no longer be able to log in or receive new assignments."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!confirmation.isActive && confirmation.driver.activeAssignment && (
              <p className="mb-3 text-sm text-amber-700">
                Driver cannot be deactivated during an active trip.
              </p>
            )}
            {statusError && (
              <p aria-live="polite" className="mb-3 text-sm text-red-600">
                {statusError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={
                  saving ||
                  (!confirmation.isActive &&
                    Boolean(confirmation.driver.activeAssignment))
                }
                onClick={updateStatus}
              >
                {saving ? "Updating…" : "Confirm status"}
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setConfirmation(null);
                  setStatusError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
          <CardDescription>Showing {start}–{end} of {total} drivers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-slate-500">Loading drivers…</p>
          ) : loadError && !data ? (
            <div className="flex gap-3 text-sm text-red-600">
              <p>{loadError}</p>
              <Button variant="outline" onClick={() => void refresh()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500"><tr><th className="p-2">Driver</th><th className="p-2">Contact</th><th className="p-2">Licence number</th><th className="p-2">Licence expiry</th><th className="p-2">Licence status</th><th className="p-2">Account status</th><th className="p-2">Active assignment</th><th className="p-2">Last login</th><th className="p-2">Updated</th><th className="p-2">Actions</th></tr></thead>
                <tbody>{data?.items.map((driver) => <tr key={driver.id} className="border-b"><td className="p-2"><p className="font-medium">{driver.name}</p><p className="text-slate-500">{driver.email}</p></td><td className="p-2">{driver.phone}</td><td className="p-2">{driver.licenseNumber || "—"}</td><td className="p-2">{driver.licenseExpiry ? new Date(driver.licenseExpiry).toLocaleDateString() : "—"}</td><td className="p-2"><Badge>{licenseLabels[driver.licenseStatus]}</Badge></td><td className="p-2"><Badge>{driver.isActive ? "Active" : "Inactive"}</Badge></td><td className="p-2">{driver.activeAssignment ? <><p>{driver.activeAssignment.status} · {driver.activeAssignment.vehicle.regNumber}</p><p className="text-slate-500">{driver.activeAssignment.fromLocation.cityName} → {driver.activeAssignment.toLocation.cityName} · {driver.activeAssignment.id.slice(0, 8)}</p></> : "None"}</td><td className="p-2">{driver.lastLoginAt ? new Date(driver.lastLoginAt).toLocaleDateString() : "Never"}</td><td className="p-2">{new Date(driver.updatedAt).toLocaleDateString()}</td><td className="p-2"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => openForm(driver)}>Edit</Button><Button size="sm" variant="outline" disabled={saving || (driver.isActive && Boolean(driver.activeAssignment))} onClick={() => openConfirmation(driver)}>{driver.isActive ? "Deactivate driver" : "Activate driver"}</Button></div></td></tr>)}</tbody>
              </table>
            </div>
            {!loading && data?.items.length === 0 && <p className="mt-3 text-sm text-slate-500">{search || status !== "all" || licenseStatus !== "all" ? "No drivers match these filters." : "No drivers have been onboarded."}</p>}
            {loadError && data && <div className="mt-3 flex gap-3 text-sm text-red-600"><p>{loadError}</p><Button variant="outline" onClick={() => void refresh()}>Retry</Button></div>}
            {loading && data && <p className="mt-3 text-sm text-slate-500">Refreshing drivers…</p>}
            <div className="mt-4 flex gap-2"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page * 10 >= total || loading} onClick={() => setPage(page + 1)}>Next</Button></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
