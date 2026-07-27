/**
 * File: src/modules/contact/contact.rate-limit.ts
 * Purpose: Apply a small in-memory submission limit to the anonymous contact endpoint.
 * Why: The endpoint needs basic abuse resistance without adding infrastructure or dependencies.
 */
import type { NextFunction, Request, Response } from "express";

type ContactRateLimitConfig = {
  windowMs: number;
  maxSubmissions: number;
  maxTrackedKeys: number;
};

type Clock = { now: () => number };
type RateLimitEntry = { count: number; resetsAt: number };

const DEFAULT_CONFIG: ContactRateLimitConfig = {
  windowMs: 15 * 60 * 1_000,
  maxSubmissions: 5,
  maxTrackedKeys: 10_000,
};

export function createContactRateLimiter(
  config: ContactRateLimitConfig = DEFAULT_CONFIG,
  clock: Clock = { now: () => Date.now() },
) {
  if (
    config.windowMs <= 0 ||
    config.maxSubmissions <= 0 ||
    config.maxTrackedKeys <= 0
  ) {
    throw new Error("Contact rate-limit values must be positive.");
  }

  const entries = new Map<string, RateLimitEntry>();

  const evictOldestAtCapacity = (): void => {
    while (entries.size >= config.maxTrackedKeys) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      entries.delete(oldestKey);
    }
  };

  const middleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const now = clock.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = entries.get(key);

    if (entry && entry.resetsAt <= now) {
      entries.delete(key);
      entry = undefined;
    }

    if (!entry) {
      evictOldestAtCapacity();
      entry = { count: 0, resetsAt: now + config.windowMs };
      entries.set(key, entry);
    }

    if (entry.count >= config.maxSubmissions) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetsAt - now) / 1_000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        message: "Too many contact submissions. Please try again later.",
      });
      return;
    }

    entry.count += 1;
    next();
  };

  return {
    middleware,
    reset: () => entries.clear(),
  };
}

const defaultContactRateLimiter = createContactRateLimiter();

export const contactRateLimit = defaultContactRateLimiter.middleware;

export function resetContactRateLimits(): void {
  defaultContactRateLimiter.reset();
}
