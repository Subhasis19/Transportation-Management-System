import "../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { configureTrustProxy } from "../config/proxy.js";
import { createRateLimiter } from "./rate-limit.js";

const limitMessage = { message: "Too many requests, please try again later" };

function createApp(limiter: ReturnType<typeof createRateLimiter>) {
  const app = express();
  app.set("trust proxy", 1);
  app.post("/auth/login", limiter, (_req, res) =>
    res.status(401).json({ message: "Invalid email or password" }),
  );
  app.options("/auth/login", limiter, (_req, res) => res.sendStatus(204));
  return app;
}

test("production config trusts one proxy hop before request middleware", () => {
  const productionApp = express();
  configureTrustProxy(productionApp, "production", false);
  assert.equal(productionApp.get("trust proxy"), 1);

  const developmentApp = express();
  configureTrustProxy(developmentApp, "development", false);
  assert.equal(developmentApp.get("trust proxy"), false);
});

test("rate limiter returns the controlled JSON response after its limit", async () => {
  const app = createApp(createRateLimiter({ windowMs: 60_000, limit: 1 }));

  assert.equal((await request(app).post("/auth/login")).status, 401);
  const limited = await request(app).post("/auth/login");
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, limitMessage);
  assert.equal(limited.headers["ratelimit-limit"], "1");
});

test("failed logins are limited per forwarded client IP", async () => {
  const app = createApp(createRateLimiter({ windowMs: 60_000, limit: 2 }));
  const firstClient = "203.0.113.10";
  const secondClient = "203.0.113.11";

  assert.equal(
    (await request(app).post("/auth/login").set("X-Forwarded-For", firstClient))
      .status,
    401,
  );
  assert.equal(
    (await request(app).post("/auth/login").set("X-Forwarded-For", firstClient))
      .status,
    401,
  );
  assert.equal(
    (await request(app).post("/auth/login").set("X-Forwarded-For", firstClient))
      .status,
    429,
  );
  assert.equal(
    (await request(app).post("/auth/login").set("X-Forwarded-For", secondClient))
      .status,
    401,
  );
});

test("successful logins do not consume failed-login allowance", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.post(
    "/auth/login",
    createRateLimiter({
      windowMs: 60_000,
      limit: 1,
      skipSuccessfulRequests: true,
    }),
    (_req, res) => res.status(200).json({ ok: true }),
  );

  assert.equal((await request(app).post("/auth/login")).status, 200);
  assert.equal((await request(app).post("/auth/login")).status, 200);
});

test("OPTIONS requests do not consume login allowance", async () => {
  const app = createApp(createRateLimiter({ windowMs: 60_000, limit: 1 }));

  assert.equal((await request(app).options("/auth/login")).status, 204);
  assert.equal((await request(app).post("/auth/login")).status, 401);
});
