import "../test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createRateLimiter } from "./rate-limit";

test("rate limiter returns the stable JSON response after its limit", async () => {
  const app = express();
  app.use(createRateLimiter(60_000, 1));
  app.get("/", (_req, res) => res.json({ ok: true }));

  assert.equal((await request(app).get("/")).status, 200);
  const limited = await request(app).get("/");
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, {
    message: "Too many requests, please try again later",
  });
});
