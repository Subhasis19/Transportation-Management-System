import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminRouteWhere,
  buildUsableRouteWhere,
  hasAtMostTwoDecimalPlaces,
  toPublicQuoteRoute,
} from "./route.rules";

test("usable route filter requires active routes and endpoint locations", () => {
  const from = "origin-id";
  const to = "destination-id";

  assert.deepEqual(buildUsableRouteWhere(from, to), {
    fromLocationId: from,
    toLocationId: to,
    isActive: true,
    fromLocation: { isActive: true },
    toLocation: { isActive: true },
  });
  assert.equal(from, "origin-id");
  assert.equal(to, "destination-id");
});

test("admin route filters support status and case-insensitive endpoint search", () => {
  assert.deepEqual(buildAdminRouteWhere({ search: "", status: "all" }), {});
  assert.deepEqual(buildAdminRouteWhere({ search: "", status: "active" }), {
    isActive: true,
  });
  assert.deepEqual(buildAdminRouteWhere({ search: "", status: "inactive" }), {
    isActive: false,
  });

  const query = { search: "cut", status: "inactive" as const };
  assert.deepEqual(buildAdminRouteWhere(query), {
    OR: [
      {
        fromLocation: {
          cityName: { contains: "cut", mode: "insensitive" },
        },
      },
      {
        toLocation: {
          cityName: { contains: "cut", mode: "insensitive" },
        },
      },
    ],
    isActive: false,
  });
  assert.deepEqual(query, { search: "cut", status: "inactive" });
});

test("precision helper accepts up to two decimals and rejects three", () => {
  for (const value of [1, 1.1, 0.29, 12.34, 99.99]) {
    assert.equal(hasAtMostTwoDecimalPlaces(value), true);
  }
  for (const value of [10.001, 80.123]) {
    assert.equal(hasAtMostTwoDecimalPlaces(value), false);
  }
});

test("public quote route mapper exposes only legacy route fields", () => {
  const mapped = toPublicQuoteRoute({
    id: "route-id",
    fromLocationId: "from",
    toLocationId: "to",
    distanceKm: 12.5,
    tollAmount: 30,
  });
  assert.deepEqual(mapped, {
    id: "route-id",
    fromLocationId: "from",
    toLocationId: "to",
    distanceKm: 12.5,
    tollAmount: 30,
  });
  assert.equal("isActive" in mapped, false);
  assert.equal("createdAt" in mapped, false);
  assert.equal("updatedAt" in mapped, false);
});
