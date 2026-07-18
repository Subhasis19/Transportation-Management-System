import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
let viteServer;
let createApiClient;

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function saveSession(storage, { accessToken = "expired", refreshToken = "refresh-old" } = {}) {
  storage.setItem(
    "tms-user",
    JSON.stringify({ id: "user-1", name: "Ada", role: "CUSTOMER" }),
  );
  storage.setItem("tms-access", accessToken);
  storage.setItem("tms-refresh", refreshToken);
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

before(async () => {
  viteServer = await createServer({
    root: clientRoot,
    logLevel: "error",
    server: { middlewareMode: true },
  });
  ({ createApiClient } = await viteServer.ssrLoadModule("/src/lib/api-client.ts"));
});

after(async () => {
  await viteServer.close();
});

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createStorage(),
  });
});

test("refreshes once and retries the original request with the new access token", async () => {
  saveSession(globalThis.localStorage);
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const headers = new Headers(options.headers);
    calls.push({ url: String(url), authorization: headers.get("Authorization") });
    if (String(url).endsWith("/auth/refresh"))
      return jsonResponse(200, {
        accessToken: "access-new",
        refreshToken: "refresh-new",
      });
    if (calls.filter((call) => call.url.endsWith("/bookings")).length === 1)
      return jsonResponse(401, { message: "Expired" });
    return jsonResponse(200, { id: "booking-1" });
  };

  const request = createApiClient("expired");
  const result = await request("/bookings");

  assert.deepEqual(result, { id: "booking-1" });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].authorization, "Bearer expired");
  assert.equal(calls[2].authorization, "Bearer access-new");
  assert.equal(globalThis.localStorage.getItem("tms-access"), "access-new");
  assert.equal(globalThis.localStorage.getItem("tms-refresh"), "refresh-new");
});

test("shares one refresh request across simultaneous 401 responses", async () => {
  saveSession(globalThis.localStorage);
  let refreshCalls = 0;
  let resolveRefresh;
  const refreshResponse = new Promise((resolve) => {
    resolveRefresh = resolve;
  });
  const requestCounts = new Map();
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/refresh") {
      refreshCalls += 1;
      return refreshResponse;
    }
    const count = (requestCounts.get(path) ?? 0) + 1;
    requestCounts.set(path, count);
    return count === 1
      ? jsonResponse(401, { message: "Expired" })
      : jsonResponse(200, { path });
  };

  const request = createApiClient("expired");
  const responses = Promise.all([request("/first"), request("/second")]);
  for (let index = 0; index < 10 && refreshCalls === 0; index += 1)
    await Promise.resolve();

  assert.equal(refreshCalls, 1);
  resolveRefresh(
    jsonResponse(200, {
      accessToken: "access-new",
      refreshToken: "refresh-new",
    }),
  );

  assert.deepEqual(await responses, [{ path: "/first" }, { path: "/second" }]);
  assert.equal(refreshCalls, 1);
  assert.equal(requestCounts.get("/first"), 2);
  assert.equal(requestCounts.get("/second"), 2);
});

test("clears authentication state when refresh fails", async () => {
  saveSession(globalThis.localStorage);
  let authenticationFailures = 0;
  globalThis.fetch = async (url) =>
    String(url).endsWith("/auth/refresh")
      ? jsonResponse(401, { message: "Refresh expired" })
      : jsonResponse(401, { message: "Expired" });

  await assert.rejects(
    createApiClient("expired", {
      onAuthenticationFailure: () => {
        authenticationFailures += 1;
      },
    })("/bookings"),
    /Refresh expired/,
  );

  assert.equal(authenticationFailures, 1);
  assert.equal(globalThis.localStorage.getItem("tms-user"), null);
  assert.equal(globalThis.localStorage.getItem("tms-access"), null);
  assert.equal(globalThis.localStorage.getItem("tms-refresh"), null);
});

test("retries an original request only once after refresh", async () => {
  saveSession(globalThis.localStorage);
  let bookingCalls = 0;
  let refreshCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return jsonResponse(200, {
        accessToken: "access-new",
        refreshToken: "refresh-new",
      });
    }
    bookingCalls += 1;
    return jsonResponse(401, { message: "Still unauthorized" });
  };

  await assert.rejects(createApiClient("expired")("/bookings"), /Still unauthorized/);

  assert.equal(bookingCalls, 2);
  assert.equal(refreshCalls, 1);
});

test("does not refresh a 401 response from the refresh endpoint", async () => {
  saveSession(globalThis.localStorage);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(401, { message: "Refresh expired" });
  };

  await assert.rejects(
    createApiClient("expired")("/auth/refresh"),
    /Refresh expired/,
  );

  assert.equal(calls, 1);
  assert.equal(globalThis.localStorage.getItem("tms-access"), "expired");
});

test("does not refresh failed login or registration requests", async () => {
  saveSession(globalThis.localStorage);
  const paths = [];
  globalThis.fetch = async (url) => {
    paths.push(new URL(String(url)).pathname);
    return jsonResponse(401, { message: "Invalid credentials" });
  };

  const request = createApiClient("expired");
  await assert.rejects(request("/auth/login"), /Invalid credentials/);
  await assert.rejects(request("/auth/register"), /Invalid credentials/);

  assert.deepEqual(paths, ["/auth/login", "/auth/register"]);
});
