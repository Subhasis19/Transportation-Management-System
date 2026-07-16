import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, Driver, Report } from "@/types/domain";

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
