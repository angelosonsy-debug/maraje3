import { rateLimit } from "express-rate-limit";

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res): void => {
    res.status(429).json({ error: "طلبات كثيرة. حاول مرة أخرى بعد قليل." });
  },
});

export const adminAuthFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res): boolean => res.statusCode !== 401,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res): void => {
    res
      .status(429)
      .json({ error: "تجاوزت محاولات الدخول الفاشلة. حاول بعد 15 دقيقة." });
  },
});
