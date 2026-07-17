import assert from "node:assert/strict";
import test from "node:test";
import {
  adminRouteQuerySchema,
  createRouteSchema,
  quoteQuerySchema,
  routeParamsSchema,
  updateRouteSchema,
  updateRouteStatusSchema,
} from "./route.schema";

const fromLocationId = "11111111-1111-4111-8111-111111111111";
const toLocationId = "22222222-2222-4222-8222-222222222222";
const validRoute = {
  fromLocationId,
  toLocationId,
  distanceKm: 1,
  tollAmount: 0,
};

test("quote query accepts valid UUIDs and rejects invalid UUIDs", () => {
  assert.equal(
    quoteQuerySchema.safeParse({ fromLocationId, toLocationId }).success,
    true,
  );
  assert.equal(
    quoteQuerySchema.safeParse({ fromLocationId: "invalid", toLocationId })
      .success,
    false,
  );
});

test("admin route query applies defaults, trimming, and status filters", () => {
  assert.deepEqual(adminRouteQuerySchema.parse({}), {
    search: "",
    status: "all",
  });
  assert.deepEqual(
    adminRouteQuerySchema.parse({ search: "  Pune  ", status: "active" }),
    { search: "Pune", status: "active" },
  );
  assert.deepEqual(adminRouteQuerySchema.parse({ status: "inactive" }), {
    search: "",
    status: "inactive",
  });
  assert.equal(
    adminRouteQuerySchema.safeParse({ status: "pending" }).success,
    false,
  );
});

test("route creation validates limits, precision, and unknown fields", () => {
  assert.equal(createRouteSchema.safeParse(validRoute).success, true);
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, toLocationId: fromLocationId })
      .success,
    true,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: 0 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: -1 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: 100_000 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: "148.5" }).success,
    true,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: 148.75 }).success,
    true,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: 10.001 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, tollAmount: -1 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, tollAmount: "0.2" }).success,
    true,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, tollAmount: 0.29 }).success,
    true,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, tollAmount: 80.123 }).success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, unexpected: true }).success,
    false,
  );
});

test("route creation preserves numeric coercion and rejects non-finite values", () => {
  const result = createRouteSchema.safeParse({
    ...validRoute,
    distanceKm: "12.34",
    tollAmount: "99.99",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.distanceKm, 12.34);
    assert.equal(result.data.tollAmount, 99.99);
  }
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, distanceKm: Number.NaN })
      .success,
    false,
  );
  assert.equal(
    createRouteSchema.safeParse({ ...validRoute, tollAmount: Infinity }).success,
    false,
  );
});

test("route numeric inputs reject blanks and booleans while preserving zero toll", () => {
  for (const input of [
    { distanceKm: "" },
    { tollAmount: "" },
    { tollAmount: "   " },
    { distanceKm: false },
    { tollAmount: false },
  ]) {
    assert.equal(createRouteSchema.safeParse({ ...validRoute, ...input }).success, false);
  }

  const result = createRouteSchema.safeParse({
    ...validRoute,
    distanceKm: "12.50",
    tollAmount: "0",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.distanceKm, 12.5);
    assert.equal(result.data.tollAmount, 0);
  }
});

test("route updates accept partial values and reject empty or unknown input", () => {
  assert.deepEqual(updateRouteSchema.parse({ distanceKm: "12.34" }), {
    distanceKm: 12.34,
  });
  assert.equal(updateRouteSchema.safeParse({}).success, false);
  assert.equal(
    updateRouteSchema.safeParse({ tollAmount: 30, unexpected: true }).success,
    false,
  );
  assert.equal(
    updateRouteSchema.safeParse({ tollAmount: 10.001 }).success,
    false,
  );
  assert.equal(updateRouteSchema.safeParse({ distanceKm: "" }).success, false);
  assert.equal(updateRouteSchema.safeParse({ tollAmount: false }).success, false);
  assert.deepEqual(updateRouteSchema.parse({ tollAmount: "0" }), {
    tollAmount: 0,
  });
});

test("route parameters and status input are strict", () => {
  assert.deepEqual(routeParamsSchema.parse({ routeId: fromLocationId }), {
    routeId: fromLocationId,
  });
  assert.equal(routeParamsSchema.safeParse({ routeId: "invalid" }).success, false);
  assert.deepEqual(updateRouteStatusSchema.parse({ isActive: true }), {
    isActive: true,
  });
  assert.equal(
    updateRouteStatusSchema.safeParse({ isActive: "true" }).success,
    false,
  );
  assert.equal(
    updateRouteStatusSchema.safeParse({ isActive: true, unexpected: true })
      .success,
    false,
  );
});
