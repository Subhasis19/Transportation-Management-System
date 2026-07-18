import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, Report } from "@/types/domain";

type BookingListProps = {
  bookings: Booking[];
  request: ApiRequest;
  report: Report;
};

export function BookingList({ bookings, request, report }: BookingListProps) {
  const documentUrl = async (id: string, kind: "lr" | "invoice") => {
    const documentWindow = window.open("", "_blank");
    if (documentWindow) documentWindow.opener = null;
    try {
      const { url } = await request<{ url: string }>(
        `/bookings/${id}/documents/${kind}`,
      );
      if (documentWindow) {
        documentWindow.location.replace(url);
      } else {
        window.location.assign(url);
      }
    } catch (error) {
      documentWindow?.close();
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
                  {booking.fromLocation.cityName} → {booking.toLocation.cityName}
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
