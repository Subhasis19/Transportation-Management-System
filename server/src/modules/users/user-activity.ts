export const ACTIVE_USER_WINDOW_DAYS = 30;

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
