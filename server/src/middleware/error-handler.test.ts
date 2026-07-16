import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { AppError } from "../common/errors/app-error";
import { errorHandler } from "./error-handler";

function createErrorApp(error: unknown) {
  const app = express();
  app.get("/", () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

test("AppError preserves its controlled response", async () => {
  const response = await request(
    createErrorApp(new AppError(409, "Controlled conflict", "CONFLICT")),
  ).get("/");

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Controlled conflict");
  assert.equal(response.body.code, "CONFLICT");
});

test("Zod validation errors return a stable 400 response", async () => {
  const response = await request(createErrorApp(new z.ZodError([]))).get("/");

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
});

test("unexpected errors do not expose internal messages", async () => {
  const response = await request(
    createErrorApp(new Error("database password and filesystem path")),
  ).get("/");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { message: "Unexpected server error" });
});
