import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type { AdminVehicle, AdminVehicleListResponse, Report, VehicleDocumentStatus, VehicleStatus, VehicleType } from "@/types/domain";

type AdminVehiclesProps = { request: ApiRequest; report: Report };
type StatusFilter = "all" | VehicleStatus;
type TypeFilter = "all" | VehicleType;
type DocumentFilter = "all" | VehicleDocumentStatus;
type Filters = { search: string; status: StatusFilter; vehicleType: TypeFilter; documentStatus: DocumentFilter; page: number };
type VehicleForm = {
  vehicle: AdminVehicle | null;
  regNumber: string;
  vehicleType: TypeFilter;
  capacityKg: string;
  rcNumber: string;
  rcExpiry: string;
  permitNumber: string;
  permitExpiry: string;
};

const vehicleTypes: VehicleType[] = ["MINI_TRUCK", "LIGHT_TRUCK", "MEDIUM_TRUCK", "HEAVY_TRUCK"];
const manualStatuses: Array<Extract<VehicleStatus, "AVAILABLE" | "MAINTENANCE" | "BREAKDOWN">> = ["AVAILABLE", "MAINTENANCE", "BREAKDOWN"];
const vehicleTypeLabels: Record<VehicleType, string> = { MINI_TRUCK: "Mini Truck", LIGHT_TRUCK: "Light Truck", MEDIUM_TRUCK: "Medium Truck", HEAVY_TRUCK: "Heavy Truck" };
const statusLabels: Record<VehicleStatus, string> = { AVAILABLE: "Available", RESERVED: "Reserved", ON_TRIP: "On Trip", MAINTENANCE: "Maintenance", BREAKDOWN: "Breakdown" };
const documentLabels: Record<VehicleDocumentStatus, string> = { VALID: "Valid", EXPIRING: "Expiring Soon", EXPIRED: "Expired" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unable to complete the vehicle action";
const dateValue = (value: string) => value.slice(0, 10);

const validNumber = (value: string, minimum: number, maximum: number) => {
  if (value.trim() === "") return false;
  const number = Number(value);
  const scaled = number * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isFinite(number) && number >= minimum && number <= maximum && Math.abs(scaled - Math.round(scaled)) <= tolerance;
};

const normalizeRegistration = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "");
const normalizeDocument = (value: string) => value.trim().toUpperCase();
const emptyForm = (): VehicleForm => ({ vehicle: null, regNumber: "", vehicleType: "all", capacityKg: "", rcNumber: "", rcExpiry: "", permitNumber: "", permitExpiry: "" });

export function AdminVehicles({ request, report }: AdminVehiclesProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vehicleType, setVehicleType] = useState<TypeFilter>("all");
  const [documentStatus, setDocumentStatus] = useState<DocumentFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminVehicleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ vehicle: AdminVehicle; status: typeof manualStatuses[number] } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const filtersRef = useRef<Filters>({ search: "", status: "all", vehicleType: "all", documentStatus: "all", page: 1 });

  useEffect(() => {
    filtersRef.current = { search: debouncedSearch, status, vehicleType, documentStatus, page };
  }, [debouncedSearch, status, vehicleType, documentStatus, page]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestId.current += 1; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadVehicles = useCallback(async (filters: Filters) => {
    if (!mounted.current) return;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const currentRequest = ++requestId.current;
    const params = new URLSearchParams({ page: String(filters.page), limit: "10", status: filters.status, vehicleType: filters.vehicleType, documentStatus: filters.documentStatus });
    if (filters.search) params.set("search", filters.search);
    setLoading(true);
    setLoadError(null);
    try {
      const result = await request<AdminVehicleListResponse>(`/admin/vehicles?${params}`, { signal: nextController.signal });
      if (mounted.current && currentRequest === requestId.current) { setData(result); setLoadError(null); }
    } catch (error) {
      if (mounted.current && !nextController.signal.aborted && currentRequest === requestId.current) setLoadError(errorMessage(error));
    } finally {
      if (mounted.current && currentRequest === requestId.current) setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadVehicles(filtersRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, status, vehicleType, documentStatus, page, loadVehicles]);
  const refresh = useCallback(() => loadVehicles(filtersRef.current), [loadVehicles]);

  const openForm = (vehicle: AdminVehicle | null) => {
    if (saving) return;
    setConfirmation(null); setStatusError(null); setFormError(null);
    setForm(vehicle ? { vehicle, regNumber: vehicle.regNumber, vehicleType: vehicle.vehicleType, capacityKg: String(vehicle.capacityKg), rcNumber: vehicle.rcNumber, rcExpiry: dateValue(vehicle.rcExpiry), permitNumber: vehicle.permitNumber, permitExpiry: dateValue(vehicle.permitExpiry) } : emptyForm());
  };
  const save = async () => {
    if (!form || saving || form.vehicleType === "all") return;
    const regNumber = normalizeRegistration(form.regNumber);
    const rcNumber = normalizeDocument(form.rcNumber);
    const permitNumber = normalizeDocument(form.permitNumber);
    if (!/^[A-Z0-9]{4,20}$/.test(regNumber) || rcNumber.length < 3 || permitNumber.length < 3 || !validNumber(form.capacityKg, 0.01, 99_999_999) || !form.rcExpiry || !form.permitExpiry) {
      setFormError("Enter valid registration, capacity, document numbers and expiry dates."); return;
    }
    if (!form.vehicle && (new Date(form.rcExpiry) <= new Date() || new Date(form.permitExpiry) <= new Date())) {
      setFormError("New vehicles must have RC and permit expiry dates later than today."); return;
    }
    setSaving(true); setFormError(null);
    try {
      const body = JSON.stringify({ regNumber, vehicleType: form.vehicleType, capacityKg: Number(form.capacityKg), rcNumber, rcExpiry: form.rcExpiry, permitNumber, permitExpiry: form.permitExpiry });
      await request<AdminVehicle>(form.vehicle ? `/admin/vehicles/${form.vehicle.id}` : "/admin/vehicles", { method: form.vehicle ? "PATCH" : "POST", body });
      if (!mounted.current) return;
      report(form.vehicle ? "Vehicle updated" : "Vehicle created"); setForm(null); await refresh();
    } catch (error) { if (mounted.current) setFormError(errorMessage(error)); }
    finally { if (mounted.current) setSaving(false); }
  };
  const openConfirmation = (vehicle: AdminVehicle, nextStatus: typeof manualStatuses[number]) => {
    if (saving) return;
    setForm(null); setFormError(null); setStatusError(null); setConfirmation({ vehicle, status: nextStatus });
  };
  const updateStatus = async () => {
    if (!confirmation || saving) return;
    setSaving(true); setStatusError(null);
    try {
      await request<AdminVehicle>(`/admin/vehicles/${confirmation.vehicle.id}/status`, { method: "PATCH", body: JSON.stringify({ status: confirmation.status }) });
      if (!mounted.current) return;
      report("Vehicle status updated"); setConfirmation(null); await refresh();
    } catch (error) { if (mounted.current) setStatusError(errorMessage(error)); }
    finally { if (mounted.current) setSaving(false); }
  };
  const setFilter = <T,>(setter: (value: T) => void, value: T) => { setter(value); setPage(1); };
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);

  return <div className="space-y-6">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">ADMIN CONTROL CENTRE</p><h1 className="mt-2 text-3xl font-bold">Vehicle Master</h1><p className="mt-1 text-sm text-slate-500">Manage fleet registration, capacity, compliance and operational availability.</p><p className="mt-2 text-sm text-amber-700">Reserved and on-trip statuses are controlled by the booking lifecycle.</p></div><Button disabled={saving} onClick={() => openForm(null)}>Add vehicle</Button></section>
    <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-4"><label className="grid gap-1 text-sm font-medium md:col-span-2">Search<input className="h-9 rounded border px-3 font-normal" placeholder="Search registration, RC or permit number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label className="grid gap-1 text-sm font-medium">Status<select className="h-9 rounded border px-3 font-normal" value={status} onChange={(event) => setFilter(setStatus, event.target.value as StatusFilter)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Vehicle type<select className="h-9 rounded border px-3 font-normal" value={vehicleType} onChange={(event) => setFilter(setVehicleType, event.target.value as TypeFilter)}><option value="all">All vehicle types</option>{vehicleTypes.map((value) => <option key={value} value={value}>{vehicleTypeLabels[value]}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Documents<select className="h-9 rounded border px-3 font-normal" value={documentStatus} onChange={(event) => setFilter(setDocumentStatus, event.target.value as DocumentFilter)}><option value="all">All documents</option>{Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex items-end"><Button variant="outline" onClick={() => { setSearch(""); setStatus("all"); setVehicleType("all"); setDocumentStatus("all"); setPage(1); }}>Clear filters</Button></div></CardContent></Card>
    {form && <Card><CardHeader><CardTitle>{form.vehicle ? "Edit vehicle" : "Add vehicle"}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Registration number<input className="h-9 rounded border px-3 font-normal" value={form.regNumber} onChange={(event) => setForm({ ...form, regNumber: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">Vehicle type<select className="h-9 rounded border px-3 font-normal" value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value as TypeFilter })}>{vehicleTypes.map((value) => <option key={value} value={value}>{vehicleTypeLabels[value]}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Capacity in kilograms<input className="h-9 rounded border px-3 font-normal" type="number" step="0.01" value={form.capacityKg} onChange={(event) => setForm({ ...form, capacityKg: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">RC number<input className="h-9 rounded border px-3 font-normal" value={form.rcNumber} onChange={(event) => setForm({ ...form, rcNumber: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">RC expiry date<input className="h-9 rounded border px-3 font-normal" type="date" value={form.rcExpiry} onChange={(event) => setForm({ ...form, rcExpiry: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">Permit number<input className="h-9 rounded border px-3 font-normal" value={form.permitNumber} onChange={(event) => setForm({ ...form, permitNumber: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">Permit expiry date<input className="h-9 rounded border px-3 font-normal" type="date" value={form.permitExpiry} onChange={(event) => setForm({ ...form, permitExpiry: event.target.value })} /></label>{formError && <p aria-live="polite" className="text-sm text-red-600 md:col-span-2">{formError}</p>}<div className="flex gap-2 md:col-span-2"><Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save vehicle"}</Button><Button variant="outline" disabled={saving} onClick={() => setForm(null)}>Cancel</Button></div></CardContent></Card>}
    {confirmation && <Card><CardHeader><CardTitle>{statusLabels[confirmation.vehicle.status]} → {statusLabels[confirmation.status]} for {confirmation.vehicle.regNumber}</CardTitle><CardDescription>{confirmation.status === "AVAILABLE" ? "The vehicle must have valid RC and permit documents." : "The vehicle will not appear in new customer quote options."}</CardDescription></CardHeader><CardContent><>{statusError && <p aria-live="polite" className="mb-3 text-sm text-red-600">{statusError}</p>}</><Button disabled={saving} onClick={updateStatus}>{saving ? "Updating…" : "Confirm status"}</Button><Button variant="outline" disabled={saving} onClick={() => { setConfirmation(null); setStatusError(null); }}>Cancel</Button></CardContent></Card>}
    <Card><CardHeader><CardTitle>Vehicles</CardTitle><CardDescription>Showing {start}–{end} of {total} vehicles</CardDescription></CardHeader><CardContent>{loading && !data ? <p className="text-sm text-slate-500">Loading vehicles…</p> : loadError && !data ? <div className="flex gap-3 text-sm text-red-600"><p>{loadError}</p><Button variant="outline" onClick={() => void refresh()}>Retry</Button></div> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="p-2">Registration</th><th className="p-2">Vehicle type</th><th className="p-2">Capacity</th><th className="p-2">Operational status</th><th className="p-2">RC expiry</th><th className="p-2">Permit expiry</th><th className="p-2">Document status</th><th className="p-2">Active booking</th><th className="p-2">Updated</th><th className="p-2">Actions</th></tr></thead><tbody>{data?.items.map((vehicle) => <tr key={vehicle.id} className="border-b"><td className="p-2 font-medium">{vehicle.regNumber}</td><td className="p-2">{vehicleTypeLabels[vehicle.vehicleType]}</td><td className="p-2">{new Intl.NumberFormat("en-IN").format(vehicle.capacityKg)} kg</td><td className="p-2"><Badge>{statusLabels[vehicle.status]}</Badge></td><td className="p-2">{new Date(vehicle.rcExpiry).toLocaleDateString()}</td><td className="p-2">{new Date(vehicle.permitExpiry).toLocaleDateString()}</td><td className="p-2"><Badge>{documentLabels[vehicle.documentStatus]}</Badge></td><td className="p-2">{vehicle.activeBooking ? `${vehicle.activeBooking.status} · ${vehicle.activeBooking.id.slice(0, 8)}` : "None"}</td><td className="p-2">{new Date(vehicle.updatedAt).toLocaleDateString()}</td><td className="p-2"><div className="flex flex-wrap gap-2">{vehicle.activeBooking ? <span className="text-xs text-slate-500">Vehicle details are locked during an active booking. Status is controlled by the active booking.</span> : <><Button size="sm" variant="outline" disabled={saving} onClick={() => openForm(vehicle)}>Edit</Button>{manualStatuses.filter((nextStatus) => nextStatus !== vehicle.status).map((nextStatus) => <Button key={nextStatus} size="sm" variant="outline" disabled={saving} onClick={() => openConfirmation(vehicle, nextStatus)}>{nextStatus === "AVAILABLE" ? "Mark Available" : nextStatus === "MAINTENANCE" ? "Send to Maintenance" : "Mark Breakdown"}</Button>)}</>}</div></td></tr>)}</tbody></table></div>{!loading && data?.items.length === 0 && <p className="mt-3 text-sm text-slate-500">{search || status !== "all" || vehicleType !== "all" || documentStatus !== "all" ? "No vehicles match these filters." : "No vehicles have been registered."}</p>}{loadError && data && <div className="mt-3 flex gap-3 text-sm text-red-600"><p>{loadError}</p><Button variant="outline" onClick={() => void refresh()}>Retry</Button></div>}{loading && data && <p className="mt-3 text-sm text-slate-500">Refreshing vehicles…</p>}<div className="mt-4 flex gap-2"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page * 10 >= total || loading} onClick={() => setPage(page + 1)}>Next</Button></div></>}</CardContent></Card>
  </div>;
}
