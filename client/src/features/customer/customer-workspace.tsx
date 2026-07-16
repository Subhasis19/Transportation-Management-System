import { BookingForm } from "@/features/bookings/booking-form";
import { BookingList } from "@/features/bookings/booking-list";
import type { ApiRequest } from "@/lib/api-client";
import type { Booking, Location, Quote, Report } from "@/types/domain";

type CustomerWorkspaceProps = {
  locations: Location[];
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  request: ApiRequest;
  onBooked: () => Promise<void>;
  report: Report;
  bookings: Booking[];
};

export function CustomerWorkspace({
  locations,
  quote,
  setQuote,
  request,
  onBooked,
  report,
  bookings,
}: CustomerWorkspaceProps) {
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
        <BookingForm
          locations={locations}
          quote={quote}
          setQuote={setQuote}
          request={request}
          onBooked={onBooked}
          report={report}
        />
        <BookingList bookings={bookings} request={request} report={report} />
      </div>
    </div>
  );
}
