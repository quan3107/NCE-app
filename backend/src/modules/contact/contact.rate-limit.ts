/**
 * File: src/modules/contact/contact.rate-limit.ts
 * Purpose: Apply a small in-memory submission limit to the anonymous contact endpoint.
 * Why: The endpoint needs basic abuse resistance without adding infrastructure or dependencies.
 */
import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 15 * 60 * 1_000;
const MAX_SUBMISSIONS = 5;

type RateLimitEntry = { count: number; resetsAt: number };
const contactRateLimits = new Map<string, RateLimitEntry>();

export function resetContactRateLimits(): void {
  contactRateLimits.clear();
}

function removeExpiredEntries(now: number): void {
  if (contactRateLimits.size < 1_000) return;
  for (const [key, entry] of contactRateLimits) {
    if (entry.resetsAt <= now) contactRateLimits.delete(key);
  }
}

export function contactRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = contactRateLimits.get(key);
  const entry = !current || current.resetsAt <= now
    ? { count: 0, resetsAt: now + WINDOW_MS }
    : current;

  removeExpiredEntries(now);

  if (entry.count >= MAX_SUBMISSIONS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetsAt - now) / 1_000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      message: "Too many contact submissions. Please try again later.",
    });
    return;
  }

  entry.count += 1;
  contactRateLimits.set(key, entry);
  next();
}
