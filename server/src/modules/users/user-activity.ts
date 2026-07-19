import type { Prisma } from "../../generated/prisma/client.js";

export const ACTIVE_USER_WINDOW_DAYS = 30;

export type UserActivityStatus = "RECENT" | "STALE" | "NEVER";
export type UserActivityFilter = "all" | "recent" | "stale" | "never";

const activeUserWindowMilliseconds = ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function getActiveUserCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - activeUserWindowMilliseconds);
}

export function isRecentlyActive(
  lastLoginAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return lastLoginAt !== null && lastLoginAt !== undefined && lastLoginAt >= getActiveUserCutoff(now);
}

export function getUserActivityStatus(
  lastLoginAt: Date | null,
  now: Date = new Date(),
): UserActivityStatus {
  if (!lastLoginAt) return "NEVER";
  return isRecentlyActive(lastLoginAt, now) ? "RECENT" : "STALE";
}

export function getUserActivityWhere(
  filter: UserActivityFilter,
  now: Date = new Date(),
): Prisma.UserWhereInput {
  const cutoff = getActiveUserCutoff(now);
  switch (filter) {
    case "recent":
      return { lastLoginAt: { gte: cutoff } };
    case "stale":
      return { lastLoginAt: { not: null, lt: cutoff } };
    case "never":
      return { lastLoginAt: null };
    case "all":
      return {};
  }
}
