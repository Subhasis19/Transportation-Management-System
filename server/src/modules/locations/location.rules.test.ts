import assert from "node:assert/strict";
import test from "node:test";
import { areLocationNamesEquivalent, buildAdminLocationWhere, normalizeLocationName } from "./location.rules";

test("normalizes location names without changing casing", () => {
  assert.equal(normalizeLocationName("  New   Delhi  "), "New Delhi");
  assert.equal(normalizeLocationName("Bhubaneswar"), "Bhubaneswar");
});

test("builds admin location filters without mutating the query", () => {
  const query = { search: "pur", status: "active" as const };
  assert.deepEqual(buildAdminLocationWhere({ search: "", status: "all" }), {});
  assert.deepEqual(buildAdminLocationWhere({ search: "pur", status: "all" }), { cityName: { contains: "pur", mode: "insensitive" } });
  assert.deepEqual(buildAdminLocationWhere({ search: "", status: "inactive" }), { isActive: false });
  assert.deepEqual(buildAdminLocationWhere(query), { cityName: { contains: "pur", mode: "insensitive" }, isActive: true });
  assert.deepEqual(query, { search: "pur", status: "active" });
});

test("compares normalized names case-insensitively without mutating inputs", () => {
  const first = "  New   Delhi  ";
  const second = "new delhi";
  assert.equal(areLocationNamesEquivalent(first, second), true);
  assert.equal(areLocationNamesEquivalent("Cuttack", "Puri"), false);
  assert.equal(first, "  New   Delhi  ");
  assert.equal(second, "new delhi");
});
