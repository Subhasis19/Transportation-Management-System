import test from "node:test";
import assert from "node:assert/strict";
import { calculateFare } from "./fare.js";

test("calculates and rounds a fare snapshot", () => {
  assert.deepEqual(calculateFare({ distanceKm: 148, tollAmount: 280, baseFare: 1200, perKmRate: 19, gstPercent: 18 }), { distanceKm: 148, baseFare: 1200, distanceCharge: 2812, tollAmount: 280, gstPercent: 18, gstAmount: 772.56, total: 5064.56 });
});

test("calculates a zero-toll, zero-GST fare", () => {
  assert.deepEqual(
    calculateFare({
      distanceKm: 10,
      tollAmount: 0,
      baseFare: 100,
      perKmRate: 5,
      gstPercent: 0,
    }),
    {
      distanceKm: 10,
      baseFare: 100,
      distanceCharge: 50,
      tollAmount: 0,
      gstPercent: 0,
      gstAmount: 0,
      total: 150,
    },
  );
});

test("handles decimal distances, rates, and base fares to two decimal places", () => {
  assert.deepEqual(
    calculateFare({
      distanceKm: 12.345,
      tollAmount: 0.105,
      baseFare: 100.105,
      perKmRate: 7.891,
      gstPercent: 18,
    }),
    {
      distanceKm: 12.345,
      baseFare: 100.11,
      distanceCharge: 97.41,
      tollAmount: 0.11,
      gstPercent: 18,
      gstAmount: 35.57,
      total: 233.19,
    },
  );
});

test("calculates subtotal before GST and does not mutate input", () => {
  const input = {
    distanceKm: 2.5,
    tollAmount: 10.25,
    baseFare: 50.5,
    perKmRate: 4.2,
    gstPercent: 10,
  };
  const original = { ...input };

  const fare = calculateFare(input);

  assert.deepEqual(input, original);
  assert.equal(fare.distanceCharge, 10.5);
  assert.equal(fare.gstAmount, 7.13);
  assert.equal(fare.total, 78.38);
});
