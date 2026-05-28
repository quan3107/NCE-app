/**
 * File: tests/modules/auth/auth.routes.rate-limit.test.ts
 * Purpose: Validate HTTP auth route throttling for IP-scoped endpoints.
 * Why: Ensures abusive auth traffic receives deterministic 429 responses.
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { resetAuthRateLimiter } from "../../../src/modules/auth/auth.service.js";

const limitedAuthRequests = [
  {
    name: "registration",
    send: () => request(app).post("/api/v1/auth/register").send({}),
  },
  {
    name: "refresh",
    send: () => request(app).post("/api/v1/auth/refresh").send({}),
  },
  {
    name: "Google start",
    send: () => request(app).get("/api/v1/auth/google"),
  },
  {
    name: "Google callback",
    send: () =>
      request(app).get("/api/v1/auth/google/callback?code=abc&state=xyz"),
  },
];

describe("auth route rate limiting", () => {
  beforeEach(() => {
    resetAuthRateLimiter();
  });

  it.each(limitedAuthRequests)(
    "returns 429 after repeated $name attempts from the same IP",
    async ({ send }) => {
      await expect(send()).resolves.not.toMatchObject({ status: 429 });
      await expect(send()).resolves.not.toMatchObject({ status: 429 });
      await expect(send()).resolves.not.toMatchObject({ status: 429 });

      const response = await send();

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message: "Too many authentication attempts. Please try again later.",
        details: {
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds: 60,
        },
      });
    },
  );

  it("does not apply auth route limits to non-auth routes", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app).post("/api/v1/auth/register").send({});
    }

    const response = await request(app).get("/api/v1/not-an-auth-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Not Found" });
  });

  it("uses the forwarded client address instead of collapsing clients behind a proxy", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", "203.0.113.10")
        .send({});
    }

    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("X-Forwarded-For", "203.0.113.20")
      .send({});

    expect(response.status).not.toBe(429);
  });
});
