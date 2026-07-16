import { useMemo, useState } from "react";
import { AppShell } from "@/app/app-shell";
import { Workspace } from "@/app/workspace";
import { AuthScreen } from "@/features/auth/auth-screen";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useWorkspace } from "@/hooks/use-workspace";
import { createApiClient } from "./lib/api-client";

function App() {
  const { user, accessToken, saveAuthenticatedSession, signOut: clearAuthSession } =
    useAuthSession();
  const [message, setMessage] = useState("");

  const request = useMemo(() => createApiClient(accessToken), [accessToken]);
  const {
    locations,
    quote,
    setQuote,
    bookings,
    dashboard,
    refreshWorkspace,
    clearWorkspace,
  } = useWorkspace({ user, request, report: setMessage });

  function saveSession(payload: Parameters<typeof saveAuthenticatedSession>[0]) {
    saveAuthenticatedSession(payload);
    setMessage(`Welcome, ${payload.user.name}`);
  }
  function signOut() {
    clearAuthSession();
    clearWorkspace();
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
    <AppShell user={user} message={message} onSignOut={signOut}>
      <Workspace
        user={user}
        locations={locations}
        quote={quote}
        setQuote={setQuote}
        bookings={bookings}
        dashboard={dashboard}
        request={request}
        report={setMessage}
        refreshWorkspace={refreshWorkspace}
      />
    </AppShell>
  );
}

export default App;
