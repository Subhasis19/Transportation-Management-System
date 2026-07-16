import type { AuthSession, User } from "../types/domain";

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.role === "ADMIN" ||
      candidate.role === "CUSTOMER" ||
      candidate.role === "DRIVER")
  );
}

export function getStoredUser(): User | null {
  const rawUser = localStorage.getItem("tms-user");
  if (!rawUser) return null;

  try {
    const parsed: unknown = JSON.parse(rawUser);
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredAccessToken(): string {
  return localStorage.getItem("tms-access") || "";
}

export function getStoredRefreshToken(): string {
  return localStorage.getItem("tms-refresh") || "";
}

export function saveStoredSession(session: AuthSession): void {
  localStorage.setItem("tms-user", JSON.stringify(session.user));
  localStorage.setItem("tms-access", session.accessToken);
  localStorage.setItem("tms-refresh", session.refreshToken);
}

export function clearStoredSession(): void {
  localStorage.removeItem("tms-user");
  localStorage.removeItem("tms-access");
  localStorage.removeItem("tms-refresh");
}
