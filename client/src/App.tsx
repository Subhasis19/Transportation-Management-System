import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
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

type AuthFormValues = z.infer<typeof authSchema>;
type BookingFormInput = z.input<typeof bookingSchema>;
type BookingFormValues = z.infer<typeof bookingSchema>;
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  phone: z.string().optional(),
});
const bookingSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  pickupAt: z.string().min(1),
  vehicleId: z.string().uuid(),
  consignorName: z.string().min(2),
  consigneeName: z.string().min(2),
  materialDescription: z.string().min(2),
  weightKg: z.coerce.number().positive(),
  declaredValue: z.coerce.number().positive(),
  viaRoute: z.string().optional(),
});

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

function AuthScreen({
  onAuthenticated,
  report,
  message,
  request,
}: {
  onAuthenticated: (payload: AuthSession) => void;
  report: Report;
  message: string;
  request: ApiRequest;
}) {
  const [registering, setRegistering] = useState(false);
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "", name: "", phone: "" },
  });
  async function submit(values: AuthFormValues) {
    console.log("SUBMIT FIRED", values); // debug log to check if submit is firing
    try {
      const payload = await request<AuthSession>(
        registering ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            registering
              ? values
              : { email: values.email, password: values.password },
          ),
        },
      );
      onAuthenticated(payload);
    } catch (error) {
      report(error instanceof Error ? error.message : "Unable to authenticate");
    }
  }
  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-6">
      <div className="absolute top-6 right-6">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="font-heading text-sm font-semibold text-primary">
            Transportation Management System
          </p>
          <CardTitle>
            {registering ? "Create customer account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {registering
              ? "Book compliant vehicles with transparent pricing."
              : "Sign in to your transport workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            {registering && (
              <Field
                label="Full name"
                error={form.formState.errors.name?.message}
              >
                <Input {...form.register("name")} />
              </Field>
            )}
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            {registering && (
              <Field label="Phone" error={form.formState.errors.phone?.message}>
                <Input {...form.register("phone")} />
              </Field>
            )}
            <Field
              label="Password"
              error={form.formState.errors.password?.message}
            >
              <Input type="password" {...form.register("password")} />
            </Field>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Please wait..."
                : registering
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-sm text-primary underline"
            onClick={() => setRegistering(!registering)}
          >
            {registering
              ? "Already have an account? Sign in"
              : "New customer? Create an account"}
          </button>
          {message && <p className="mt-4 text-sm text-destructive">{message}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

function CustomerWorkspace({
  locations,
  quote,
  setQuote,
  request,
  onBooked,
  report,
  bookings,
}: {
  locations: Location[];
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  request: ApiRequest;
  onBooked: () => Promise<void>;
  report: Report;
  bookings: Booking[];
}) {
  const form = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      fromLocationId: "",
      toLocationId: "",
      pickupAt: "",
      vehicleId: "",
      consignorName: "",
      consigneeName: "",
      materialDescription: "",
      weightKg: 0,
      declaredValue: 0,
      viaRoute: "",
    },
  });
  const findQuote = async () => {
    try {
      const { fromLocationId, toLocationId } = form.getValues();
      setQuote(
        await request<Quote>(
          `/quotes?fromLocationId=${fromLocationId}&toLocationId=${toLocationId}`,
        ),
      );
    } catch (error) {
      report(error instanceof Error ? error.message : "Unable to quote route");
    }
  };
  const submit = async (values: BookingFormValues) => {
    try {
      await request<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          pickupAt: new Date(values.pickupAt).toISOString(),
        }),
      });
      report(
        "Booking placed. Your vehicle is now reserved pending confirmation.",
      );
      form.reset();
      setQuote(null);
      onBooked();
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Unable to place booking",
      );
    }
  };
  return (
    <div className="space-y-8">
      <section>
        <p className="font-heading text-xs font-semibold tracking-[0.2em] text-indigo-600">
          CUSTOMER PORTAL
        </p>
        <h1 className="mt-2 text-3xl font-bold">Book a compliant vehicle</h1>
        <p className="mt-2 text-slate-600">
          Choose the route first, compare transparent fares, then reserve the
          right truck.
        </p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>New booking</CardTitle>
            <CardDescription>
              Route matrix pricing is calculated before you reserve a vehicle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="From"
                  {...form.register("fromLocationId")}
                  locations={locations}
                />
                <SelectField
                  label="To"
                  {...form.register("toLocationId")}
                  locations={locations}
                />
              </div>
              <Button type="button" variant="secondary" onClick={findQuote}>
                Find available vehicles
              </Button>
              {quote && (
                <>
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <b>{quote.route.distanceKm} km</b> route · Toll{" "}
                    {currency(quote.route.tollAmount)}
                  </div>
                  <div className="grid gap-3">
                    {quote.options.map((option) => (
                      <label
                        key={option.vehicle.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border p-4 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50"
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            value={option.vehicle.id}
                            {...form.register("vehicleId")}
                          />
                          <span>
                            <b>
                              {option.vehicle.vehicleType.replace("_", " ")}
                            </b>
                            <br />
                            <small>
                              {option.vehicle.regNumber} ·{" "}
                              {option.vehicle.capacityKg} kg
                            </small>
                          </span>
                        </span>
                        <b>{currency(option.fare.total)}</b>
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pickup date & time">
                      <Input
                        type="datetime-local"
                        {...form.register("pickupAt")}
                      />
                    </Field>
                    <Field label="Via (optional)">
                      <Input {...form.register("viaRoute")} />
                    </Field>
                    <Field label="Consignor">
                      <Input {...form.register("consignorName")} />
                    </Field>
                    <Field label="Consignee">
                      <Input {...form.register("consigneeName")} />
                    </Field>
                    <Field label="Material">
                      <Input {...form.register("materialDescription")} />
                    </Field>
                    <Field label="Weight (kg)">
                      <Input type="number" {...form.register("weightKg")} />
                    </Field>
                    <Field label="Declared value">
                      <Input
                        type="number"
                        {...form.register("declaredValue")}
                      />
                    </Field>
                  </div>
                  <Button
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    Reserve selected vehicle
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
        <BookingList bookings={bookings} request={request} report={report} />
      </div>
    </div>
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

function BookingList({
  bookings,
  request,
  report,
}: {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
}) {
  const documentUrl = async (id: string, kind: "lr" | "invoice") => {
    try {
      const { url } = await request<{ url: string }>(
        `/bookings/${id}/documents/${kind}`,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      report(error instanceof Error ? error.message : "Document unavailable");
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your bookings</CardTitle>
        <CardDescription>
          Track reservations and retrieve issued documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length ? (
          bookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <b>
                  {booking.fromLocation.cityName} →{" "}
                  {booking.toLocation.cityName}
                </b>
                <Badge>{booking.status}</Badge>
              </div>
              <p className="mt-1 text-slate-500">
                {booking.vehicle.regNumber} ·{" "}
                {currency(Number(booking.estimatedFare))}
              </p>
              <div className="mt-2 flex gap-2">
                {booking.lrPdfUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => documentUrl(booking.id, "lr")}
                  >
                    LR
                  </Button>
                )}
                {booking.invoicePdfUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => documentUrl(booking.id, "invoice")}
                  >
                    Invoice
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No bookings yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
function SelectField({
  label,
  locations,
  ...props
}: { label: string; locations: Location[] } & ComponentPropsWithoutRef<"select">) {
  return (
    <Field label={label}>
      <select
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        {...props}
      >
        <option value="">Select city</option>
        {locations.map((location: Location) => (
          <option key={location.id} value={location.id}>
            {location.cityName}
          </option>
        ))}
      </select>
    </Field>
  );
}
export default App;
