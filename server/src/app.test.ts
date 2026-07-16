import "./test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

const { default: app } = await import("./app");

test("GET /health returns the current success response", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: "TruckLine API is running",
  });
});

test("an unknown endpoint returns the current not-found response", async () => {
  const response = await request(app).get("/unknown-endpoint");

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    message: "Route not found",
    code: "ROUTE_NOT_FOUND",
  });
});

test("a protected endpoint rejects a missing authorization header", async () => {
  const response = await request(app).get("/quotes");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Authentication required" });
});

test("a protected endpoint rejects a malformed bearer token", async () => {
  const response = await request(app)
    .get("/quotes")
    .set("Authorization", "Bearer malformed-token");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    message: "Invalid or expired access token",
  });
});

test("responses include Helmet security headers", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("the configured frontend origin receives the CORS header", async () => {
  const response = await request(app)
    .get("/health")
    .set("Origin", "http://frontend.test.local");

  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://frontend.test.local",
  );
});
