import assert from "node:assert/strict";
import test from "node:test";
import { isVehicleCompliant } from "./booking.shared";

test("vehicle compliance requires future RC and permit dates", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60 * 1000);
  const past = new Date(now.getTime() - 60 * 60 * 1000);

  assert.equal(
    isVehicleCompliant({ rcExpiry: future, permitExpiry: future }),
    true,
  );
  assert.equal(
    isVehicleCompliant({ rcExpiry: past, permitExpiry: future }),
    false,
  );
  assert.equal(
    isVehicleCompliant({ rcExpiry: future, permitExpiry: past }),
    false,
  );
  assert.equal(
    isVehicleCompliant({ rcExpiry: past, permitExpiry: past }),
    false,
  );
});

test("vehicle compliance rejects dates at or before the current time", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60 * 1000);

  assert.equal(
    isVehicleCompliant({ rcExpiry: now, permitExpiry: future }),
    false,
  );
  assert.equal(
    isVehicleCompliant({ rcExpiry: future, permitExpiry: now }),
    false,
  );
});
