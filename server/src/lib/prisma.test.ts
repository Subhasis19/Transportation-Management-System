import "../test/test-env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolConfig } from "./prisma.js";

test("database pool bounds connections and acquisition wait time", () => {
  assert.deepEqual(databasePoolConfig, {
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });
});
