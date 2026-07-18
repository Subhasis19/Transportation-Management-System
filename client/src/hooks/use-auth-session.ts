import { useCallback, useState } from "react";
import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredUser,
  saveStoredSession,
} from "@/lib/session-storage";
import type { AuthSession } from "@/types/domain";

export function useAuthSession() {
  const [user, setUser] = useState(getStoredUser);
  const [accessToken, setAccessToken] = useState(getStoredAccessToken);

  const saveAuthenticatedSession = useCallback((session: AuthSession) => {
    saveStoredSession(session);
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setAccessToken("");
  }, []);

  return { user, accessToken, saveAuthenticatedSession, signOut };
}
