import rateLimit from "express-rate-limit";

const message = { message: "Too many requests, please try again later" };

export function createRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json(message),
  });
}

export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 300);
export const loginRateLimiter = createRateLimiter(15 * 60 * 1000, 10);
export const registerRateLimiter = createRateLimiter(60 * 60 * 1000, 5);
export const refreshRateLimiter = createRateLimiter(15 * 60 * 1000, 30);
