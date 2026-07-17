import assert from "node:assert/strict";
import test from "node:test";
import { adminLocationQuerySchema, createLocationSchema, locationParamsSchema, updateLocationSchema, updateLocationStatusSchema } from "./location.schema";

test("location write schemas normalize and reject invalid fields", () => {
  assert.deepEqual(createLocationSchema.parse({ cityName: "  New   Delhi " }), { cityName: "New Delhi" });
  assert.throws(() => createLocationSchema.parse({ cityName: "A" }));
  assert.throws(() => createLocationSchema.parse({ cityName: "A".repeat(101) }));
  assert.throws(() => createLocationSchema.parse({ cityName: "Puri", isActive: true }));
  assert.deepEqual(updateLocationSchema.parse({ cityName: " Cuttack " }), { cityName: "Cuttack" });
  assert.throws(() => updateLocationSchema.parse({}));
});

test("location params and status schemas are strict", () => {
  const locationId = "b3fda17e-38c8-4e5f-93c8-a5de06dd4f73";
  assert.equal(locationParamsSchema.parse({ locationId }).locationId, locationId);
  assert.throws(() => locationParamsSchema.parse({ locationId: "invalid" }));
  assert.deepEqual(updateLocationStatusSchema.parse({ isActive: true }), { isActive: true });
  assert.throws(() => updateLocationStatusSchema.parse({ isActive: "false" }));
});

test("admin location query defaults and validates filters", () => {
  assert.deepEqual(adminLocationQuerySchema.parse({}), { search: "", status: "all" });
  assert.deepEqual(adminLocationQuerySchema.parse({ search: " pur ", status: "active" }), { search: "pur", status: "active" });
  assert.deepEqual(adminLocationQuerySchema.parse({ status: "inactive" }), { search: "", status: "inactive" });
  assert.throws(() => adminLocationQuerySchema.parse({ status: "disabled" }));
});
