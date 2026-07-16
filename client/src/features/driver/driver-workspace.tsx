import { useState } from "react";
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
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, Report } from "@/types/domain";

type DriverWorkspaceProps = {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
  refresh: () => Promise<void>;
};

export function DriverWorkspace({
  bookings,
  request,
  report,
  refresh,
}: DriverWorkspaceProps) {
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
