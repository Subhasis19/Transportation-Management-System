import assert from "node:assert/strict";
import test from "node:test";
import { buildUsableRouteWhere, toPublicQuoteRoute } from "./route.rules";

test("usable route filter requires active endpoint locations without route activation", () => {
  const from = "origin-id";
  const to = "destination-id";
  const where = buildUsableRouteWhere(from, to);
  assert.deepEqual(where, { fromLocationId: from, toLocationId: to, fromLocation: { isActive: true }, toLocation: { isActive: true } });
  assert.equal("isActive" in where, false);
  assert.equal(from, "origin-id");
  assert.equal(to, "destination-id");
});

test("public quote route mapper exposes only legacy route fields", () => {
  const mapped = toPublicQuoteRoute({ id: "route-id", fromLocationId: "from", toLocationId: "to", distanceKm: 12.5, tollAmount: 30 });
  assert.deepEqual(mapped, { id: "route-id", fromLocationId: "from", toLocationId: "to", distanceKm: 12.5, tollAmount: 30 });
  assert.equal("isActive" in mapped, false);
  assert.equal("createdAt" in mapped, false);
  assert.equal("updatedAt" in mapped, false);
});
