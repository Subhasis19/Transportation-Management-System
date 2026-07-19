import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignDriverToActiveTrip,
  isWeightWithinVehicleCapacity,
} from "./booking.rules.js";

test("cargo weight must not exceed vehicle capacity", () => {
  assert.equal(isWeightWithinVehicleCapacity(1000, 1000), true);
  assert.equal(isWeightWithinVehicleCapacity(1000.01, 1000), false);
});

test("drivers cannot receive a second active assignment", () => {
  assert.equal(canAssignDriverToActiveTrip(0), true);
  assert.equal(canAssignDriverToActiveTrip(1), false);
});
