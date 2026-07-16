import assert from "node:assert/strict";
import test from "node:test";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "./auth.schema";

const validRegistration = {
  name: "  Test User  ",
  email: "test@example.com",
  phone: "  +919876543210  ",
  password: "Password@123",
};

test("register schema accepts valid data and trims name and phone", () => {
  const result = registerSchema.safeParse(validRegistration);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.name, "Test User");
  assert.equal(result.data.phone, "+919876543210");
});

test("register schema rejects invalid registration fields", () => {
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, email: "invalid" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, phone: "123" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, name: "A" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, password: "short" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, password: "a".repeat(73) })
      .success,
    false,
  );
});

test("login and refresh token schemas preserve current requirements", () => {
  assert.equal(
    loginSchema.safeParse({ email: "test@example.com", password: "x" }).success,
    true,
  );
  assert.equal(
    loginSchema.safeParse({ email: "test@example.com", password: "" }).success,
    false,
  );
  assert.equal(
    refreshTokenSchema.safeParse({ refreshToken: "token" }).success,
    true,
  );
  assert.equal(refreshTokenSchema.safeParse({ refreshToken: "" }).success, false);
});
