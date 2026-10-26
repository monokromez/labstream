import rateLimit from "express-rate-limit";

export function createAuthAttemptLimiter({ limit, windowMs = 2 * 60 * 1000 } = {}) {
  return rateLimit({
    windowMs,
    limit: limit ?? (process.env.NODE_ENV === "production" ? 10 : 60),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method !== "POST",
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json({
      error: "AUTH_RATE_LIMITED",
      message: "Too many unsuccessful sign-in or activation attempts. Wait 2 minutes, then try again.",
    }),
  });
}
