import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { CustomerWorkspace } from "@/features/customer/customer-workspace";
import { DriverWorkspace } from "@/features/driver/driver-workspace";
import type { ApiRequest } from "@/lib/api-client";
import type {
  Booking,
  Dashboard,
  Location,
  Quote,
  Report,
  User,
} from "@/types/domain";

type WorkspaceProps = {
  user: User;
  locations: Location[];
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
  bookings: Booking[];
  dashboard: Dashboard | null;
  request: ApiRequest;
  report: Report;
  refreshWorkspace: () => Promise<void>;
};

export function Workspace({
  user,
  locations,
  quote,
  setQuote,
  bookings,
  dashboard,
  request,
  report,
  refreshWorkspace,
}: WorkspaceProps) {
  if (user.role === "CUSTOMER")
    return (
      <CustomerWorkspace
        locations={locations}
        quote={quote}
        setQuote={setQuote}
        request={request}
        onBooked={refreshWorkspace}
        report={report}
        bookings={bookings}
      />
    );
  if (user.role === "ADMIN")
    return (
      <AdminWorkspace
        dashboard={dashboard}
        request={request}
        report={report}
        refresh={refreshWorkspace}
      />
    );
  return (
    <DriverWorkspace
      bookings={bookings}
      request={request}
      report={report}
      refresh={refreshWorkspace}
    />
  );
}
