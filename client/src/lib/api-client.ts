const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export type ApiRequest = <ResponseBody>(
  path: string,
  options?: RequestInit,
) => Promise<ResponseBody>;

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("message" in body)) return null;
  const message = (body as { message: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function createApiClient(accessToken: string): ApiRequest {
  return async <ResponseBody,>(
    path: string,
    options: RequestInit = {},
  ): Promise<ResponseBody> => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(`${API}${path}`, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const body: unknown =
      response.status === 204
        ? null
        : contentType.includes("application/json")
          ? await response.json()
          : await response.text();
    if (!response.ok)
      throw new Error(errorMessage(body) || "Something went wrong");
    return body as ResponseBody;
  };
}
