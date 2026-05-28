/**
 * File: tests/modules/auth/auth.rate-limit.test.ts
 * Purpose: Validate in-memory auth throttling behavior with an injectable clock.
 * Why: Keeps lockout semantics deterministic without depending on wall-clock time.
 */
import { describe, expect, it } from "vitest";

import {
  AUTH_RATE_LIMITED_MESSAGE,
  createAuthRateLimiter,
} from "../../../src/modules/auth/auth.rate-limit.js";

const config = {
  passwordLogin: {
    maxFailures: 3,
    windowMs: 10_000,
    lockoutMs: 30_000,
  },
  ipAttempts: {
    maxAttempts: 2,
    windowMs: 10_000,
  },
};

describe("auth.rate-limit", () => {
  it("locks password login after repeated failures and releases it after lockout", () => {
    let now = 1_000;
    const limiter = createAuthRateLimiter(config, { now: () => now });
    const attempt = {
      email: "Learner@Example.com",
      ipAddress: "203.0.113.10",
    };

    limiter.recordPasswordLoginFailure(attempt);
    limiter.recordPasswordLoginFailure(attempt);

    expect(() => limiter.assertPasswordLoginAllowed(attempt)).not.toThrow();

    limiter.recordPasswordLoginFailure(attempt);

    expect(() => limiter.assertPasswordLoginAllowed(attempt)).toThrow(
      expect.objectContaining({
        statusCode: 429,
        message: AUTH_RATE_LIMITED_MESSAGE,
        details: expect.objectContaining({
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds: 30,
        }),
      }),
    );

    now += config.passwordLogin.windowMs;

    expect(() => limiter.assertPasswordLoginAllowed(attempt)).toThrow(
      expect.objectContaining({
        statusCode: 429,
        details: expect.objectContaining({
          retryAfterSeconds: 20,
        }),
      }),
    );

    now += config.passwordLogin.lockoutMs - config.passwordLogin.windowMs;

    expect(() => limiter.assertPasswordLoginAllowed(attempt)).not.toThrow();
  });

  it("clears the account failure counter after a successful password login", () => {
    const limiter = createAuthRateLimiter(config, { now: () => 2_000 });

    limiter.recordPasswordLoginFailure({
      email: "learner@example.com",
      ipAddress: "203.0.113.10",
    });
    limiter.recordPasswordLoginFailure({
      email: "learner@example.com",
      ipAddress: "203.0.113.11",
    });
    limiter.recordPasswordLoginSuccess({
      email: "LEARNER@example.com",
      ipAddress: "203.0.113.12",
    });
    limiter.recordPasswordLoginFailure({
      email: "learner@example.com",
      ipAddress: "203.0.113.13",
    });

    expect(() =>
      limiter.assertPasswordLoginAllowed({
        email: "learner@example.com",
        ipAddress: "203.0.113.14",
      }),
    ).not.toThrow();
  });

  it("limits repeated route attempts by IP and expires the window", () => {
    let now = 5_000;
    const limiter = createAuthRateLimiter(config, { now: () => now });
    const ipAddress = "198.51.100.20";

    limiter.recordRouteAttempt("register", ipAddress);

    expect(() => limiter.recordRouteAttempt("register", ipAddress)).not.toThrow();

    expect(() => limiter.recordRouteAttempt("register", ipAddress)).toThrow(
      expect.objectContaining({
        statusCode: 429,
        message: AUTH_RATE_LIMITED_MESSAGE,
        details: expect.objectContaining({
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds: 10,
        }),
      }),
    );

    now += config.ipAttempts.windowMs;

    expect(() => limiter.recordRouteAttempt("register", ipAddress)).not.toThrow();
  });
});
