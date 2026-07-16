import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/mode-toggle";
import { AuthScreen } from "@/features/auth/auth-screen";
import { CustomerWorkspace } from "@/features/customer/customer-workspace";
import { createApiClient } from "./lib/api-client";
import { currency } from "./lib/formatters";
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredUser,
  saveStoredSession,
} from "./lib/session-storage";
import type { ApiRequest } from "./lib/api-client";
import type {
  AuthSession,
  Booking,
  Dashboard,
  Driver,
  Location,
  Quote,
  Report,
  User,
  WorkspaceData,
} from "./types/domain";

function App() {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [accessToken, setAccessToken] = useState(getStoredAccessToken);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");

  const request = useMemo(() => createApiClient(accessToken), [accessToken]);

  const fetchWorkspace = useCallback(
    async (signal?: AbortSignal): Promise<WorkspaceData | null> => {
      if (!user) return null;
      if (user.role === "CUSTOMER") {
        const [locationData, bookingData] = await Promise.all([
          request<Location[]>("/locations", { signal }),
          request<Booking[]>("/bookings/mine", { signal }),
        ]);
        return {
          role: "CUSTOMER",
          locations: locationData,
          bookings: bookingData,
        };
      }
      if (user.role === "DRIVER")
        return {
          role: "DRIVER",
          bookings: await request<Booking[]>("/bookings/mine", { signal }),
        };
      return {
        role: "ADMIN",
        dashboard: await request<Dashboard>("/admin/dashboard", { signal }),
      };
    },
    [request, user],
  );

  const applyWorkspace = useCallback((workspace: WorkspaceData) => {
    if (workspace.role === "CUSTOMER") {
      setLocations(workspace.locations);
      setBookings(workspace.bookings);
    }
    if (workspace.role === "DRIVER") setBookings(workspace.bookings);
    if (workspace.role === "ADMIN") setDashboard(workspace.dashboard);
  }, []);

  const loadWorkspace = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const workspace = await fetchWorkspace(signal);
        if (!signal?.aborted && workspace) applyWorkspace(workspace);
      } catch (error) {
        if (signal?.aborted) return;
        setMessage(
          error instanceof Error ? error.message : "Unable to load workspace",
        );
      }
    },
    [applyWorkspace, fetchWorkspace],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchWorkspace(controller.signal)
      .then((workspace) => {
        if (!controller.signal.aborted && workspace) applyWorkspace(workspace);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Unable to load workspace",
          );
      });
    return () => controller.abort();
  }, [applyWorkspace, fetchWorkspace]);

  function saveSession(payload: AuthSession) {
    saveStoredSession(payload);
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    setMessage(`Welcome, ${payload.user.name}`);
  }
  function signOut() {
    clearStoredSession();
    setUser(null);
    setAccessToken("");
    setQuote(null);
    setBookings([]);
    setDashboard(null);
  }

  if (!user)
    return (
      <AuthScreen
        onAuthenticated={saveSession}
        report={setMessage}
        message={message}
        request={request}
      />
    );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-heading text-xl font-semibold tracking-wide">
              TRUCKLINE
            </p>
            <p className="text-xs text-muted-foreground">
              Transportation management, made clear
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{user.role}</Badge>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.name}
            </span>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <p className="mb-5 rounded-md bg-primary/10 px-4 py-3 text-sm text-primary">
            {message}
          </p>
        )}
        {user.role === "CUSTOMER" && (
          <CustomerWorkspace
            locations={locations}
            quote={quote}
            setQuote={setQuote}
            request={request}
            onBooked={loadWorkspace}
            report={setMessage}
            bookings={bookings}
          />
        )}
        {user.role === "ADMIN" && (
          <AdminWorkspace
            dashboard={dashboard}
            request={request}
            report={setMessage}
            refresh={loadWorkspace}
          />
        )}
        {user.role === "DRIVER" && (
          <DriverWorkspace
            bookings={bookings}
            request={request}
            report={setMessage}
            refresh={loadWorkspace}
          />
        )}
      </div>
    </main>
  );
}

function AdminWorkspace({
  dashboard,
  request,
  report,
  refresh,
}: {
  dashboard: Dashboard | null;
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
}) {
  const statusMap = new Map(
    dashboard?.vehicles.map(({ status, _count }) => [status, _count]),
  );
  return (
    <div className="space-y-7">
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

function AdminBookings({
  bookings,
  request,
  report,
  refresh,
}: {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  useEffect(() => {
    let isCurrent = true;
    void request<Driver[]>("/admin/drivers")
      .then((driverData) => {
        if (isCurrent) setDrivers(driverData);
      })
      .catch((error: unknown) => {
        if (isCurrent)
          report(
            error instanceof Error ? error.message : "Unable to load drivers",
          );
      });
    return () => {
      isCurrent = false;
    };
  }, [report, request]);

  const act = async (
    id: string,
    action: "confirm" | "depart" | "close",
  ) => {
    try {
      const driverId = drivers[0]?.id;
      if (action === "confirm" && !driverId)
        throw new Error("Add a compliant driver first");
      await request<Booking>(`/admin/bookings/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(
          action === "confirm"
            ? { driverId }
            : {},
        ),
      });
      report(
        `Booking ${{
          confirm: "confirmed",
          depart: "departed",
          close: "closed",
        }[action]}`,
      );
      await refresh();
    } catch (error) {
      report(error instanceof Error ? error.message : "Action failed");
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent bookings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <b>
                {booking.fromLocation.cityName} → {booking.toLocation.cityName}
              </b>
              <Badge>{booking.status}</Badge>
            </div>
            <p className="mt-1 text-slate-500">
              {booking.customer.name} · {booking.vehicle.regNumber}
            </p>
            <div className="mt-3 flex gap-2">
              {booking.status === "PENDING" && (
                <Button size="sm" onClick={() => act(booking.id, "confirm")}>
                  Confirm
                </Button>
              )}
              {booking.status === "CONFIRMED" && (
                <Button size="sm" onClick={() => act(booking.id, "depart")}>
                  Depart
                </Button>
              )}
              {booking.status === "INVOICED" && (
                <Button size="sm" onClick={() => act(booking.id, "close")}>
                  Close trip
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DriverWorkspace({
  bookings,
  request,
  report,
  refresh,
}: {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const deliver = async (id: string) => {
    try {
      await request<Booking>(`/driver/bookings/${id}/deliver`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setNotes("");
      report("Delivery recorded and invoice generated.");
      refresh();
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Could not record delivery",
      );
    }
  };
  return (
    <div className="space-y-6">
      <section>
        <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
          DRIVER WORKSPACE
        </p>
        <h1 className="mt-2 text-3xl font-bold">Assigned trips</h1>
      </section>
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardHeader>
            <CardTitle>
              {booking.fromLocation.cityName} → {booking.toLocation.cityName}
            </CardTitle>
            <CardDescription>
              {booking.vehicle.regNumber} · {booking.materialDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {booking.status === "IN_TRANSIT" ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Delivery note"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <Button onClick={() => deliver(booking.id)}>
                  Confirm delivery
                </Button>
              </div>
            ) : (
              <Badge>{booking.status}</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default App;
