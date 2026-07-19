import rateLimit from "express-rate-limit";

const message = { message: "Too many requests, please try again later" };

type RateLimiterOptions = {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
};

export function createRateLimiter({
  windowMs,
  limit,
  skipSuccessfulRequests = false,
}: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    skipSuccessfulRequests,
    handler: (_req, res) => res.status(429).json(message),
  });
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
});
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
});
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
});
export const refreshRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
});
