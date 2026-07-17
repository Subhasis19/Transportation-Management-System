import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, DriverOption, Report } from "@/types/domain";

type AdminBookingsProps = {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
};

export function AdminBookings({
  bookings,
  request,
  report,
  refresh,
}: AdminBookingsProps) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({});
  useEffect(() => {
    let isCurrent = true;
    void request<DriverOption[]>("/admin/drivers/options")
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

  const loadDriverOptions = async () => {
    const driverData = await request<DriverOption[]>("/admin/drivers/options");
    setDrivers(driverData);
  };

  const act = async (
    id: string,
    action: "confirm" | "depart" | "close",
  ) => {
    try {
      const driverId = driverSelections[id];
      if (action === "confirm" && !driverId)
        throw new Error("Select an eligible driver first");
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
      if (action === "confirm") await loadDriverOptions();
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
                <>
                  {drivers.length ? (
                    <select
                      className="h-8 rounded border px-2 text-sm"
                      value={driverSelections[booking.id] || ""}
                      onChange={(event) =>
                        setDriverSelections({
                          ...driverSelections,
                          [booking.id]: event.target.value,
                        })
                      }
                    >
                      <option value="">Select driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} · {driver.licenseNumber}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No eligible drivers are currently available.
                    </p>
                  )}
                  <Button
                    size="sm"
                    disabled={!driverSelections[booking.id]}
                    onClick={() => act(booking.id, "confirm")}
                  >
                    Confirm
                  </Button>
                </>
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
