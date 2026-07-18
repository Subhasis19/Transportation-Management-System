import {
  clearStoredSession,
  getStoredRefreshToken,
  getStoredUser,
  saveStoredSession,
} from "./session-storage";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export type ApiRequest = <ResponseBody>(
  path: string,
  options?: RequestInit,
) => Promise<ResponseBody>;

type RefreshResponse = { accessToken: string; refreshToken: string };
type ApiClientCallbacks = {
  onSessionRefreshed?: (session: RefreshResponse) => void;
  onAuthenticationFailure?: () => void;
};

let refreshInFlight: Promise<RefreshResponse> | null = null;

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("message" in body)) return null;
  const message = (body as { message: unknown }).message;
  return typeof message === "string" ? message : null;
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  return response.status === 204
    ? null
    : contentType.includes("application/json")
      ? response.json()
      : response.text();
}

function isRefreshResponse(value: unknown): value is RefreshResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    "refreshToken" in value &&
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string"
  );
}

function refreshAuthentication(): Promise<RefreshResponse> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getStoredRefreshToken();
  refreshInFlight = (async () => {
    if (!refreshToken) throw new Error("Authentication required");
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const body = await readResponse(response);
    if (!response.ok || !isRefreshResponse(body)) {
      throw new Error(errorMessage(body) || "Authentication required");
    }
    if (getStoredRefreshToken() !== refreshToken) {
      throw new Error("Authentication required");
    }
    const user = getStoredUser();
    if (!user) throw new Error("Authentication required");
    saveStoredSession({ user, ...body });
    return body;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function isUnauthenticatedPath(path: string) {
  return path.startsWith("/auth/");
}

export function createApiClient(
  accessToken: string,
  callbacks: ApiClientCallbacks = {},
): ApiRequest {
  return async <ResponseBody,>(
    path: string,
    options: RequestInit = {},
  ): Promise<ResponseBody> => {
    const send = async (token: string) => {
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${API}${path}`, { ...options, headers });
      return { response, body: await readResponse(response) };
    };

    const initial = await send(accessToken);
    if (
      initial.response.status !== 401 ||
      !accessToken ||
      isUnauthenticatedPath(path)
    ) {
      if (!initial.response.ok)
        throw new Error(errorMessage(initial.body) || "Something went wrong");
      return initial.body as ResponseBody;
    }

    const activeRefreshToken = getStoredRefreshToken();
    let session: RefreshResponse;
    try {
      session = await refreshAuthentication();
    } catch (error) {
      if (
        activeRefreshToken
          ? getStoredRefreshToken() === activeRefreshToken
          : getStoredUser() !== null
      ) {
        clearStoredSession();
        callbacks.onAuthenticationFailure?.();
      }
      throw error instanceof Error
        ? error
        : new Error("Authentication required");
    }

    callbacks.onSessionRefreshed?.(session);
    const retried = await send(session.accessToken);
    if (!retried.response.ok) {
      if (
        retried.response.status === 401 &&
        getStoredRefreshToken() === session.refreshToken
      ) {
        clearStoredSession();
        callbacks.onAuthenticationFailure?.();
      }
      throw new Error(errorMessage(retried.body) || "Something went wrong");
    }
    return retried.body as ResponseBody;
  };
}
