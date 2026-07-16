import "../test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth";

const { allow, authenticate, signAccessToken } = await import("./auth");
const { Role } = await import("../generated/prisma/client");

function authenticateToken(token: string | undefined) {
  let statusCode = 0;
  let body: unknown;
  let nextCalled = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  } as unknown as Response;
  const request = {
    header: (name: string) => (name === "authorization" && token ? `Bearer ${token}` : undefined),
  } as unknown as AuthRequest;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  authenticate(request, response, next);
  return { statusCode, body, nextCalled, request };
}

test("signAccessToken produces a configured 15-minute JWT with user claims", () => {
  const issuedBefore = Math.floor(Date.now() / 1000);
  const token = signAccessToken({
    id: "user-123",
    role: Role.CUSTOMER,
    email: "customer@example.com",
  });
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) throw new Error("Test access secret is required");
  const payload = jwt.verify(token, accessSecret);

  assert.equal(typeof payload, "object");
  if (typeof payload === "string") throw new Error("Expected JWT payload object");
  assert.equal(payload.id, "user-123");
  assert.equal(payload.role, Role.CUSTOMER);
  assert.equal(payload.email, "customer@example.com");
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
  if (typeof payload.exp !== "number") throw new Error("Expected expiration claim");
  const secondsUntilExpiry = payload.exp - issuedBefore;
  assert.ok(secondsUntilExpiry >= 14 * 60);
  assert.ok(secondsUntilExpiry <= 15 * 60 + 1);
});

test("configured access secret rejects tokens signed with another secret", () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) throw new Error("Test access secret is required");
  const token = jwt.sign(
    { id: "user-123", role: Role.CUSTOMER, email: "customer@example.com" },
    "another-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
  );

  assert.throws(() => jwt.verify(token, accessSecret));
});

test("authenticate rejects unsupported algorithms and invalid access payloads", () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) throw new Error("Test access secret is required");
  const unsupported = jwt.sign(
    { id: "user-123", role: Role.CUSTOMER, email: "customer@example.com" },
    accessSecret,
    { algorithm: "HS384" },
  );
  const invalidRole = jwt.sign(
    { id: "user-123", role: "UNKNOWN", email: "customer@example.com" },
    accessSecret,
    { algorithm: "HS256" },
  );
  const missingClaims = jwt.sign(
    { id: "user-123", role: Role.CUSTOMER },
    accessSecret,
    { algorithm: "HS256" },
  );

  for (const token of [unsupported, invalidRole, missingClaims]) {
    const result = authenticateToken(token);
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.body, { message: "Invalid or expired access token" });
  }
});

test("authenticate accepts a valid configured access token", () => {
  const result = authenticateToken(
    signAccessToken({
      id: "user-123",
      role: Role.CUSTOMER,
      email: "customer@example.com",
    }),
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.request.user?.id, "user-123");
});

test("allow calls next for an allowed role", () => {
  let nextCalled = false;
  const response = {
    status: () => response,
    json: () => response,
  } as unknown as Response;
  const request = {
    user: { id: "driver-123", role: Role.DRIVER, email: "driver@example.com" },
  } as unknown as AuthRequest;

  allow(Role.DRIVER)(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("allow returns 403 for a forbidden role", () => {
  let statusCode = 0;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  } as unknown as Response;
  const request = {
    user: { id: "customer-123", role: Role.CUSTOMER, email: "customer@example.com" },
  } as unknown as AuthRequest;

  allow(Role.DRIVER)(request, response, () => {
    throw new Error("next should not be called");
  });

  assert.equal(statusCode, 403);
  assert.deepEqual(body, { message: "You do not have permission for this action" });
});
