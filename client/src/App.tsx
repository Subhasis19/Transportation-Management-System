import { useMemo, useState } from "react";
import { AppShell } from "@/app/app-shell";
import { Workspace } from "@/app/workspace";
import { AuthScreen } from "@/features/auth/auth-screen";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useWorkspace } from "@/hooks/use-workspace";
import { getStoredRefreshToken } from "@/lib/session-storage";
import { createApiClient } from "./lib/api-client";

function App() {
  const { user, accessToken, saveAuthenticatedSession, signOut: clearAuthSession } =
    useAuthSession();
  const [message, setMessage] = useState("");

  const request = useMemo(
    () =>
      createApiClient(accessToken, {
        onSessionRefreshed: (session) => {
          const storedUser = user;
          if (storedUser) {
            saveAuthenticatedSession({
              user: storedUser,
              ...session,
            });
          }
        },
        onAuthenticationFailure: () => {
          clearAuthSession();
        },
      }),
    [accessToken, clearAuthSession, saveAuthenticatedSession, user],
  );
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
  async function signOut() {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await request<void>("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Local sign-out must still complete if the server cannot be reached.
    } finally {
      clearAuthSession();
      clearWorkspace();
      setMessage("");
    }
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
