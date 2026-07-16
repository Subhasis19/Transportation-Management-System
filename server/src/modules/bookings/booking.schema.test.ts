import assert from "node:assert/strict";
import test from "node:test";
import { createBookingSchema } from "./booking.schema";

const vehicleId = "33333333-3333-4333-8333-333333333333";
const fromLocationId = "11111111-1111-4111-8111-111111111111";
const toLocationId = "22222222-2222-4222-8222-222222222222";

function validBooking() {
  return {
    vehicleId,
    fromLocationId,
    toLocationId,
    pickupAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    consignorName: "Acme Logistics",
    consigneeName: "Buyer Company",
    materialDescription: "Steel coils",
    weightKg: "500.5",
    declaredValue: "100000",
  };
}

test("booking schema accepts valid input and coerces pickup time", () => {
  const result = createBookingSchema.safeParse(validBooking());

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.pickupAt instanceof Date, true);
  assert.equal(result.data.weightKg, 500.5);
  assert.equal(result.data.viaRoute, undefined);
});

test("booking schema rejects invalid identifiers and past pickup times", () => {
  assert.equal(
    createBookingSchema.safeParse({ ...validBooking(), vehicleId: "invalid" }).success,
    false,
  );
  assert.equal(
    createBookingSchema.safeParse({
      ...validBooking(),
      pickupAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }).success,
    false,
  );
});

test("booking schema preserves current string and positive-money requirements", () => {
  const booking = validBooking();

  assert.equal(
    createBookingSchema.safeParse({ ...booking, viaRoute: "  North bypass  " }).success,
    true,
  );
  assert.equal(
    createBookingSchema.safeParse({ ...booking, consignorName: "A" }).success,
    false,
  );
  assert.equal(
    createBookingSchema.safeParse({ ...booking, materialDescription: "A" }).success,
    false,
  );
  assert.equal(createBookingSchema.safeParse({ ...booking, weightKg: 0 }).success, false);
  assert.equal(
    createBookingSchema.safeParse({ ...booking, declaredValue: 0 }).success,
    false,
  );
});
