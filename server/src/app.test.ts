import "./test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

const { default: app } = await import("./app.js");

test("GET /healthz returns the current health response", async () => {
  const response = await request(app).get("/healthz");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "transportation-management-system-api",
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
  const response = await request(app).get("/healthz");

  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("responses do not disclose the Express implementation header", async () => {
  const response = await request(app).get("/healthz");

  assert.equal(response.headers["x-powered-by"], undefined);
});

test("oversized JSON requests are rejected", async () => {
  const response = await request(app)
    .post("/auth/login")
    .set("Content-Type", "application/json")
    .send({ email: "test@example.com", password: "x", padding: "x".repeat(101 * 1024) });

  assert.equal(response.status, 413);
});

test("the configured frontend origin receives the CORS header", async () => {
  const response = await request(app)
    .get("/healthz")
    .set("Origin", "http://frontend.test.local");

  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://frontend.test.local",
  );
});

test("an unapproved browser origin is not reflected by CORS", async () => {
  const response = await request(app)
    .get("/healthz")
    .set("Origin", "https://unapproved.example");

  assert.equal(response.headers["access-control-allow-origin"], undefined);
});
