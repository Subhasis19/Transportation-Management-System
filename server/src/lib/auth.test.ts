import "../test/test-env";
import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

const { signAccessToken } = await import("./auth");
const { Role } = await import("../generated/prisma/client");

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
