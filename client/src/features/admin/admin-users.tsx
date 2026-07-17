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
import { currency } from "@/lib/formatters";
import type {
  AdminUser,
  AdminUserDetail,
  AdminUserListResponse,
  Report,
  Role,
  UserActivityStatus,
} from "@/types/domain";

type AdminUsersProps = { request: ApiRequest; report: Report };
type RoleFilter = "all" | Role;
type StatusFilter = "all" | "active" | "inactive";
type ActivityFilter = "all" | "recent" | "stale" | "never";
type Filters = {
  search: string;
  role: RoleFilter;
  status: StatusFilter;
  activity: ActivityFilter;
  page: number;
};
type Confirmation = { user: AdminUser; isActive: boolean };

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  CUSTOMER: "Customer",
  DRIVER: "Driver",
};
const activityLabels: Record<UserActivityStatus, string> = {
  RECENT: "Active in last 30 days",
  STALE: "Not active in last 30 days",
  NEVER: "Never logged in",
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete the user action";

export function AdminUsers({ request, report }: AdminUsersProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);
  const listController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const detailUserIdRef = useRef<string | null>(null);
  const filtersRef = useRef<Filters>({
    search: "",
    role: "all",
    status: "all",
    activity: "all",
    page: 1,
  });

  useEffect(() => {
    filtersRef.current = {
      search: debouncedSearch,
      role,
      status,
      activity,
      page,
    };
  }, [debouncedSearch, role, status, activity, page]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      listRequestId.current += 1;
      detailRequestId.current += 1;
      listController.current?.abort();
      detailController.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(
    async (filters: Filters) => {
      if (!mounted.current) return;
      listController.current?.abort();
      const nextController = new AbortController();
      listController.current = nextController;
      const currentRequest = ++listRequestId.current;
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: "10",
        role: filters.role,
        status: filters.status,
        activity: filters.activity,
      });
      if (filters.search) params.set("search", filters.search);
      setLoading(true);
      setLoadError(null);
      try {
        const result = await request<AdminUserListResponse>(
          `/admin/users?${params}`,
          { signal: nextController.signal },
        );
        if (mounted.current && currentRequest === listRequestId.current) {
          setData(result);
          setLoadError(null);
        }
      } catch (error) {
        if (
          mounted.current &&
          !nextController.signal.aborted &&
          currentRequest === listRequestId.current
        ) {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (mounted.current && currentRequest === listRequestId.current) {
          setLoading(false);
        }
      }
    },
    [request],
  );

  const loadUserDetail = useCallback(
    async (userId: string) => {
      if (!mounted.current) return;
      detailController.current?.abort();
      const nextController = new AbortController();
      detailController.current = nextController;
      const currentRequest = ++detailRequestId.current;
      setDetailLoading(true);
      setDetailError(null);
      try {
        const result = await request<AdminUserDetail>(
          `/admin/users/${userId}`,
          {
            signal: nextController.signal,
          },
        );
        if (
          mounted.current &&
          currentRequest === detailRequestId.current &&
          detailUserIdRef.current === userId
        ) {
          setDetail(result);
          setDetailError(null);
        }
      } catch (error) {
        if (
          mounted.current &&
          !nextController.signal.aborted &&
          currentRequest === detailRequestId.current &&
          detailUserIdRef.current === userId
        ) {
          setDetailError(errorMessage(error));
        }
      } finally {
        if (
          mounted.current &&
          currentRequest === detailRequestId.current &&
          detailUserIdRef.current === userId
        ) {
          setDetailLoading(false);
        }
      }
    },
    [request],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => void loadUsers(filtersRef.current),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, role, status, activity, page, loadUsers]);

  const refresh = useCallback(() => loadUsers(filtersRef.current), [loadUsers]);

  const openDetails = (userId: string) => {
    if (saving) return;
    detailUserIdRef.current = userId;
    setDetailUserId(userId);
    setDetail(null);
    setDetailError(null);
    void loadUserDetail(userId);
  };

  const closeDetails = () => {
    detailUserIdRef.current = null;
    detailRequestId.current += 1;
    detailController.current?.abort();
    setDetailUserId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const openConfirmation = (user: AdminUser) => {
    if (saving) return;
    setStatusError(null);
    setConfirmation({ user, isActive: !user.isActive });
  };

  const updateStatus = async () => {
    if (!confirmation || saving) return;
    const { user, isActive } = confirmation;
    setSaving(true);
    setStatusError(null);
    try {
      await request<AdminUser>(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      if (!mounted.current) return;
      report("User status updated");
      setConfirmation(null);
      await refresh();
      if (detailUserIdRef.current === user.id) {
        await loadUserDetail(user.id);
      }
    } catch (error) {
      if (mounted.current) setStatusError(errorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
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
      <section>
        <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
          ADMIN CONTROL CENTRE
        </p>
        <h1 className="mt-2 text-3xl font-bold">User Directory</h1>
        <p className="mt-1 text-sm text-slate-500">
          View platform accounts, login activity and booking participation.
        </p>
        <p className="mt-2 text-sm text-amber-700">
          Roles are managed by account workflows and cannot be changed here.
        </p>
      </section>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Search
            <input
              className="h-9 rounded border px-3 font-normal"
              placeholder="Search name, email or phone"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Role
            <select
              className="h-9 rounded border px-3 font-normal"
              value={role}
              onChange={(event) =>
                setFilter(setRole, event.target.value as RoleFilter)
              }
            >
              <option value="all">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="CUSTOMER">Customer</option>
              <option value="DRIVER">Driver</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Account status
            <select
              className="h-9 rounded border px-3 font-normal"
              value={status}
              onChange={(event) =>
                setFilter(setStatus, event.target.value as StatusFilter)
              }
            >
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Activity
            <select
              className="h-9 rounded border px-3 font-normal"
              value={activity}
              onChange={(event) =>
                setFilter(setActivity, event.target.value as ActivityFilter)
              }
            >
              <option value="all">All activity</option>
              <option value="recent">Active in last 30 days</option>
              <option value="stale">Not active in last 30 days</option>
              <option value="never">Never logged in</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setRole("all");
                setStatus("all");
                setActivity("all");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {confirmation && (
        <Card>
          <CardHeader>
            <CardTitle>
              {confirmation.isActive ? "Enable account" : "Disable account"}
            </CardTitle>
            <CardDescription>
              {confirmation.isActive
                ? "The user will be allowed to authenticate again."
                : "The user will no longer be able to log in or refresh their session."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <>
              {!confirmation.isActive && confirmation.user.isCurrentUser && (
                <p className="mb-3 text-sm text-amber-700">
                  You cannot disable your own account.
                </p>
              )}
            </>
            {statusError && (
              <p aria-live="polite" className="mb-3 text-sm text-red-600">
                {statusError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={
                  saving ||
                  (!confirmation.isActive && confirmation.user.isCurrentUser)
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

      {detailUserId && (
        <Card>
          <CardHeader>
            <CardTitle>User details</CardTitle>
            <CardDescription>
              Account information and recent booking participation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailLoading && (
              <p className="text-sm text-slate-500">Loading user details…</p>
            )}
            {detailError && (
              <div className="flex gap-3 text-sm text-red-600">
                <p>{detailError}</p>
                <Button
                  variant="outline"
                  onClick={() => void loadUserDetail(detailUserId)}
                >
                  Retry details
                </Button>
              </div>
            )}
            {detail && (
              <div className="space-y-5 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <p>
                    Name: <b>{detail.name}</b>
                  </p>
                  <p>
                    Email: <b>{detail.email}</b>
                  </p>
                  <p>
                    Phone: <b>{detail.phone}</b>
                  </p>
                  <p>
                    Role: <b>{roleLabels[detail.role]}</b>
                  </p>
                  <p>
                    Account status:{" "}
                    <b>{detail.isActive ? "Active" : "Inactive"}</b>
                  </p>
                  <p>
                    Activity: <b>{activityLabels[detail.activityStatus]}</b>
                  </p>
                  <p>
                    Last login:{" "}
                    <b>
                      {detail.lastLoginAt
                        ? new Date(detail.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </b>
                  </p>
                  <p>
                    Joined:{" "}
                    <b>{new Date(detail.createdAt).toLocaleDateString()}</b>
                  </p>
                  <p>
                    Last updated:{" "}
                    <b>{new Date(detail.updatedAt).toLocaleDateString()}</b>
                  </p>
                  <p>
                    Customer bookings: <b>{detail.customerBookingCount}</b>
                  </p>
                  <p>
                    Driver assignments: <b>{detail.driverAssignmentCount}</b>
                  </p>
                  {detail.role === "DRIVER" && (
                    <>
                      <p>
                        Licence number: <b>{detail.licenseNumber || "—"}</b>
                      </p>
                      <p>
                        Licence expiry:{" "}
                        <b>
                          {detail.licenseExpiry
                            ? new Date(
                                detail.licenseExpiry,
                              ).toLocaleDateString()
                            : "—"}
                        </b>
                      </p>
                    </>
                  )}
                </div>
                <section>
                  <h3 className="font-semibold">
                    Recent bookings and assignments
                  </h3>
                  {detail.recentBookings.length ? (
                    <div className="mt-3 space-y-2">
                      {detail.recentBookings.map((booking) => (
                        <div key={booking.id} className="rounded border p-3">
                          <p>
                            <b>{booking.relationship}</b> · {booking.status} ·{" "}
                            {booking.id.slice(0, 8)}
                          </p>
                          <p>
                            {booking.fromLocation.cityName} →{" "}
                            {booking.toLocation.cityName} ·{" "}
                            {booking.vehicle.regNumber}
                          </p>
                          <p>
                            {currency(booking.estimatedFare)} · Pickup{" "}
                            {new Date(booking.pickupAt).toLocaleDateString()} ·
                            Created{" "}
                            {new Date(booking.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-500">
                      No booking activity is available for this user.
                    </p>
                  )}
                </section>
              </div>
            )}
            <Button className="mt-4" variant="outline" onClick={closeDetails}>
              Close details
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Showing {start}–{end} of {total} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-slate-500">Loading users…</p>
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
                  <thead className="border-b text-slate-500">
                    <tr>
                      <th className="p-2">User</th>
                      <th className="p-2">Role</th>
                      <th className="p-2">Account status</th>
                      <th className="p-2">Activity</th>
                      <th className="p-2">Last login</th>
                      <th className="p-2">Customer bookings</th>
                      <th className="p-2">Driver assignments</th>
                      <th className="p-2">Joined</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-2">
                          <p className="font-medium">{user.name}</p>
                          <p className="text-slate-500">{user.email}</p>
                          <p className="text-slate-500">{user.phone}</p>
                          {user.isCurrentUser && (
                            <p className="text-xs text-indigo-600">
                              Current account
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge>{roleLabels[user.role]}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge>{user.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge>{activityLabels[user.activityStatus]}</Badge>
                        </td>
                        <td className="p-2">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="p-2">{user.customerBookingCount}</td>
                        <td className="p-2">{user.driverAssignmentCount}</td>
                        <td className="p-2">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => openDetails(user.id)}
                            >
                              View details
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                saving || (user.isActive && user.isCurrentUser)
                              }
                              onClick={() => openConfirmation(user)}
                            >
                              {user.isActive
                                ? "Disable account"
                                : "Enable account"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!loading && data?.items.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">
                  {search ||
                  role !== "all" ||
                  status !== "all" ||
                  activity !== "all"
                    ? "No users match these filters."
                    : "No users are available."}
                </p>
              )}
              {loadError && data && (
                <div className="mt-3 flex gap-3 text-sm text-red-600">
                  <p>{loadError}</p>
                  <Button variant="outline" onClick={() => void refresh()}>
                    Retry
                  </Button>
                </div>
              )}
              {loading && data && (
                <p className="mt-3 text-sm text-slate-500">Refreshing users…</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page * 10 >= total || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
