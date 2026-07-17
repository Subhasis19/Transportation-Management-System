import assert from "node:assert/strict";
import test from "node:test";
import { createRouteSchema, quoteQuerySchema } from "./route.schema";

const fromLocationId = "11111111-1111-4111-8111-111111111111";
const toLocationId = "22222222-2222-4222-8222-222222222222";

test("quote query accepts valid UUIDs", () => {
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

test("route creation accepts numeric strings and rejects matching endpoints", () => {
  const result = createRouteSchema.safeParse({
    fromLocationId,
    toLocationId,
    distanceKm: "148.5",
    tollAmount: "280.25",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.distanceKm, 148.5);
  assert.equal(result.data.tollAmount, 280.25);
  assert.equal(
    createRouteSchema.safeParse({
      ...result.data,
      toLocationId: fromLocationId,
    }).success,
    false,
  );
});

test("route creation rejects invalid distances and toll amounts", () => {
  const validRoute = {
    fromLocationId,
    toLocationId,
    distanceKm: 1,
    tollAmount: 0,
  };

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
    createRouteSchema.safeParse({ ...validRoute, tollAmount: -1 }).success,
    false,
  );
});
