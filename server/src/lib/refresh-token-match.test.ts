import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingRefreshToken } from "./refresh-token-match.js";

type Candidate = { id: string; tokenHash: string };

test("uses one comparison and skips legacy rows when jti identifies a row", async () => {
  const compared: string[] = [];
  let loadedLegacy = false;
  const exact = { id: "current", tokenHash: "current-hash" };

  const result = await findMatchingRefreshToken(
    "raw-token",
    {
      findById: async () => exact,
      findLegacy: async () => {
        loadedLegacy = true;
        return [{ id: "legacy", tokenHash: "legacy-hash" }];
      },
    },
    async (_raw, hash) => {
      compared.push(hash);
      return true;
    },
  );

  assert.equal(result, exact);
  assert.deepEqual(compared, ["current-hash"]);
  assert.equal(loadedLegacy, false);
});

test("checks legacy rows sequentially and stops after the match", async () => {
  const compared: string[] = [];
  const candidates: Candidate[] = [
    { id: "newest", tokenHash: "first-hash" },
    { id: "matching", tokenHash: "matching-hash" },
    { id: "oldest", tokenHash: "unused-hash" },
  ];

  const result = await findMatchingRefreshToken(
    "raw-token",
    {
      findById: async () => null,
      findLegacy: async () => candidates,
    },
    async (_raw, hash) => {
      compared.push(hash);
      return hash === "matching-hash";
    },
  );

  assert.equal(result, candidates[1]);
  assert.deepEqual(compared, ["first-hash", "matching-hash"]);
});

test("does not fall back when a jti row exists but its hash is invalid", async () => {
  let loadedLegacy = false;

  const result = await findMatchingRefreshToken(
    "raw-token",
    {
      findById: async () => ({ id: "current", tokenHash: "invalid-hash" }),
      findLegacy: async () => {
        loadedLegacy = true;
        return [{ id: "legacy", tokenHash: "matching-hash" }];
      },
    },
    async (_raw, hash) => hash === "matching-hash",
  );

  assert.equal(result, null);
  assert.equal(loadedLegacy, false);
});
