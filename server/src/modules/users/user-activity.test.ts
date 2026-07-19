import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_USER_WINDOW_DAYS,
  getActiveUserCutoff,
  isRecentlyActive,
} from "./user-activity.js";

const now = new Date("2026-07-17T12:00:00.000Z");
const millisecondsPerDay = 24 * 60 * 60 * 1000;

test("active users use a 30-day window", () => {
  assert.equal(ACTIVE_USER_WINDOW_DAYS, 30);
  assert.equal(
    getActiveUserCutoff(now).getTime(),
    now.getTime() - ACTIVE_USER_WINDOW_DAYS * millisecondsPerDay,
  );
});

test("getActiveUserCutoff does not mutate its input", () => {
  const suppliedNow = new Date(now);
  getActiveUserCutoff(suppliedNow);
  assert.equal(suppliedNow.getTime(), now.getTime());
});

test("recent activity includes the cutoff and excludes older logins", () => {
  assert.equal(isRecentlyActive(null, now), false);
  assert.equal(isRecentlyActive(undefined, now), false);
  assert.equal(isRecentlyActive(new Date(now.getTime() - 29 * millisecondsPerDay), now), true);
  assert.equal(isRecentlyActive(new Date(now.getTime() - 30 * millisecondsPerDay), now), true);
  assert.equal(isRecentlyActive(new Date(now.getTime() - 30 * millisecondsPerDay - 1), now), false);
});

test("isRecentlyActive does not mutate its Date inputs", () => {
  const lastLoginAt = new Date(now.getTime() - 29 * millisecondsPerDay);
  const suppliedNow = new Date(now);
  isRecentlyActive(lastLoginAt, suppliedNow);
  assert.equal(lastLoginAt.getTime(), now.getTime() - 29 * millisecondsPerDay);
  assert.equal(suppliedNow.getTime(), now.getTime());
});
