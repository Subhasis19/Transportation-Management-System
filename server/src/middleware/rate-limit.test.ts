import "../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import {
  createRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
} from "./rate-limit.js";

const limitMessage = { message: "Too many requests, please try again later" };

async function expectStableLimitResponse(
  limiter: ReturnType<typeof createRateLimiter>,
  allowedRequests: number,
) {
  const app = express();
  app.use(limiter);
  app.get("/", (_req, res) => res.json({ ok: true }));

  for (let index = 0; index < allowedRequests; index += 1) {
    assert.equal((await request(app).get("/")).status, 200);
  }

  const limited = await request(app).get("/");
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, limitMessage);
}

test("rate limiter returns the stable JSON response after its limit", async () => {
  const app = express();
  app.use(createRateLimiter(60_000, 1));
  app.get("/", (_req, res) => res.json({ ok: true }));

  assert.equal((await request(app).get("/")).status, 200);
  const limited = await request(app).get("/");
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, limitMessage);
});

test("login limiter returns the stable 429 response", async () => {
  await expectStableLimitResponse(loginRateLimiter, 10);
});

test("registration limiter returns the stable 429 response", async () => {
  await expectStableLimitResponse(registerRateLimiter, 5);
});

test("refresh limiter returns the stable 429 response", async () => {
  await expectStableLimitResponse(refreshRateLimiter, 30);
});
