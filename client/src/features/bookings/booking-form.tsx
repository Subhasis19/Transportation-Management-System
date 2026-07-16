import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Field } from "@/components/shared/field";
import { LocationSelect } from "@/components/shared/location-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/formatters";
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, Location, Quote, Report } from "@/types/domain";
import { bookingSchema } from "./booking.schema";
import type { BookingFormInput, BookingFormValues } from "./booking.types";

type BookingFormProps = {
  locations: Location[];
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  request: ApiRequest;
  onBooked: () => Promise<void>;
  report: Report;
};

export function BookingForm({
  locations,
  quote,
  setQuote,
  request,
  onBooked,
  report,
}: BookingFormProps) {
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
            <LocationSelect
              label="From"
              {...form.register("fromLocationId")}
              locations={locations}
            />
            <LocationSelect
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
                  <Input type="number" {...form.register("declaredValue")} />
                </Field>
              </div>
              <Button className="w-full" disabled={form.formState.isSubmitting}>
                Reserve selected vehicle
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
