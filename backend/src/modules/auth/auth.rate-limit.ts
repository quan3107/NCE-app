/**
 * File: src/modules/auth/auth.rate-limit.ts
 * Purpose: Provide in-memory throttling for authentication endpoints.
 * Why: Keeps brute-force controls explicit while preserving a swappable limiter boundary.
 */
import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

import { config } from "../../config/env.js";
import { hashValue } from "./auth.crypto.js";
import { createAuthError } from "./auth.errors.js";

export const AUTH_RATE_LIMITED_MESSAGE =
  "Too many authentication attempts. Please try again later.";

const AUTH_RATE_LIMITED_CODE = "AUTH_RATE_LIMITED";

export type AuthRouteRateLimitKey =
  | "register"
  | "refresh"
  | "googleStart"
  | "googleCallback";

type Clock = {
  now: () => number;
};

type PasswordLoginAttempt = {
  email: string;
  ipAddress?: string | null;
};

type AuthRateLimitConfig = {
  passwordLogin: {
    maxFailures: number;
    windowMs: number;
    lockoutMs: number;
  };
  ipAttempts: {
    maxAttempts: number;
    windowMs: number;
  };
};

type Counter = {
  count: number;
  expiresAt: number;
  lockedUntil: number | null;
};

export type AuthRateLimiter = ReturnType<typeof createAuthRateLimiter>;

const createCounter = (now: number, windowMs: number): Counter => ({
  count: 0,
  expiresAt: now + windowMs,
  lockedUntil: null,
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const ipKey = (ipAddress?: string | null): string =>
  hashValue(ipAddress && ipAddress.length > 0 ? ipAddress : "unknown");

const retryAfterSeconds = (until: number, now: number): number =>
  Math.max(1, Math.ceil((until - now) / 1000));

const createRateLimitError = (retryAfter: number) => {
  const error = createAuthError(429, AUTH_RATE_LIMITED_MESSAGE) as ReturnType<
    typeof createAuthError
  > & {
    details: {
      code: typeof AUTH_RATE_LIMITED_CODE;
      retryAfterSeconds: number;
    };
  };

  error.details = {
    code: AUTH_RATE_LIMITED_CODE,
    retryAfterSeconds: retryAfter,
  };

  return error;
};

export function createAuthRateLimiter(
  rateLimitConfig: AuthRateLimitConfig,
  clock: Clock = { now: () => Date.now() },
) {
  const accountFailures = new Map<string, Counter>();
  const ipFailures = new Map<string, Counter>();
  const routeAttempts = new Map<string, Counter>();

  const currentCounter = (
    counters: Map<string, Counter>,
    key: string,
    windowMs: number,
    now: number,
  ): Counter => {
    const existing = counters.get(key);
    if (
      existing &&
      (existing.expiresAt > now ||
        (existing.lockedUntil !== null && existing.lockedUntil > now))
    ) {
      return existing;
    }

    const next = createCounter(now, windowMs);
    counters.set(key, next);
    return next;
  };

  const assertPasswordCounterAllowed = (counter: Counter, now: number): void => {
    if (counter.lockedUntil && counter.lockedUntil > now) {
      throw createRateLimitError(retryAfterSeconds(counter.lockedUntil, now));
    }
  };

  const passwordCounters = (attempt: PasswordLoginAttempt, now: number) => {
    const accountCounter = currentCounter(
      accountFailures,
      normalizeEmail(attempt.email),
      rateLimitConfig.passwordLogin.windowMs,
      now,
    );
    const ipCounter = currentCounter(
      ipFailures,
      ipKey(attempt.ipAddress),
      rateLimitConfig.passwordLogin.windowMs,
      now,
    );

    return [accountCounter, ipCounter];
  };

  const recordPasswordFailure = (counter: Counter, now: number): void => {
    counter.count += 1;
    if (counter.count >= rateLimitConfig.passwordLogin.maxFailures) {
      counter.lockedUntil = now + rateLimitConfig.passwordLogin.lockoutMs;
    }
  };

  return {
    assertPasswordLoginAllowed(attempt: PasswordLoginAttempt): void {
      const now = clock.now();
      for (const counter of passwordCounters(attempt, now)) {
        assertPasswordCounterAllowed(counter, now);
      }
    },

    recordPasswordLoginFailure(attempt: PasswordLoginAttempt): void {
      const now = clock.now();
      for (const counter of passwordCounters(attempt, now)) {
        recordPasswordFailure(counter, now);
      }
    },

    recordPasswordLoginSuccess(attempt: PasswordLoginAttempt): void {
      accountFailures.delete(normalizeEmail(attempt.email));
    },

    recordRouteAttempt(route: AuthRouteRateLimitKey, ipAddress?: string | null): void {
      const now = clock.now();
      const key = `${route}:${ipKey(ipAddress)}`;
      const counter = currentCounter(
        routeAttempts,
        key,
        rateLimitConfig.ipAttempts.windowMs,
        now,
      );

      if (counter.count >= rateLimitConfig.ipAttempts.maxAttempts) {
        throw createRateLimitError(retryAfterSeconds(counter.expiresAt, now));
      }

      counter.count += 1;
    },

    reset(): void {
      accountFailures.clear();
      ipFailures.clear();
      routeAttempts.clear();
    },
  };
}

export const authRateLimiter = createAuthRateLimiter(config.authRateLimit);

export const resetAuthRateLimiter = (): void => {
  authRateLimiter.reset();
};

export const limitAuthRoute = (route: AuthRouteRateLimitKey): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      authRateLimiter.recordRouteAttempt(route, req.ip);
      next();
    } catch (error) {
      next(error);
    }
  };
