import assert from "node:assert/strict";
import test from "node:test";
import { areLocationNamesEquivalent, normalizeLocationName } from "./location.rules";

test("normalizes location names without changing casing", () => {
  assert.equal(normalizeLocationName("  New   Delhi  "), "New Delhi");
  assert.equal(normalizeLocationName("Bhubaneswar"), "Bhubaneswar");
});

test("compares normalized names case-insensitively without mutating inputs", () => {
  const first = "  New   Delhi  ";
  const second = "new delhi";
  assert.equal(areLocationNamesEquivalent(first, second), true);
  assert.equal(areLocationNamesEquivalent("Cuttack", "Puri"), false);
  assert.equal(first, "  New   Delhi  ");
  assert.equal(second, "new delhi");
});
