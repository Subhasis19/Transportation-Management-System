import test from "node:test";
import assert from "node:assert/strict";
import { calculateFare } from "./fare";

test("calculates and rounds a fare snapshot", () => {
  assert.deepEqual(calculateFare({ distanceKm: 148, tollAmount: 280, baseFare: 1200, perKmRate: 19, gstPercent: 18 }), { distanceKm: 148, baseFare: 1200, distanceCharge: 2812, tollAmount: 280, gstPercent: 18, gstAmount: 772.56, total: 5064.56 });
});
