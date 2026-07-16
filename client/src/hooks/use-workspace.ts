import { useCallback, useEffect, useState } from "react";
import type { ApiRequest } from "@/lib/api-client";
import type {
  Booking,
  Dashboard,
  Location,
  Quote,
  Report,
  User,
  WorkspaceData,
} from "@/types/domain";

type UseWorkspaceOptions = {
  user: User | null;
  request: ApiRequest;
  report: Report;
};

export function useWorkspace({ user, request, report }: UseWorkspaceOptions) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

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

  const refreshWorkspace = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const workspace = await fetchWorkspace(signal);
        if (!signal?.aborted && workspace) applyWorkspace(workspace);
      } catch (error) {
        if (signal?.aborted) return;
        report(
          error instanceof Error ? error.message : "Unable to load workspace",
        );
      }
    },
    [applyWorkspace, fetchWorkspace, report],
  );

  const clearWorkspace = useCallback(() => {
    setLocations([]);
    setQuote(null);
    setBookings([]);
    setDashboard(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWorkspace(controller.signal)
      .then((workspace) => {
        if (!controller.signal.aborted && workspace) applyWorkspace(workspace);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          report(
            error instanceof Error ? error.message : "Unable to load workspace",
          );
      });
    return () => controller.abort();
  }, [applyWorkspace, fetchWorkspace, report]);

  return {
    locations,
    quote,
    setQuote,
    bookings,
    dashboard,
    refreshWorkspace,
    clearWorkspace,
  };
}
