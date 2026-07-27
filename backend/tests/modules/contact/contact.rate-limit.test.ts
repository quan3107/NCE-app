/**
 * File: tests/modules/contact/contact.rate-limit.test.ts
 * Purpose: Verify contact abuse counters expire and remain strictly bounded.
 * Why: Attacker-controlled client identities must not create unbounded CPU or heap growth.
 */
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createContactRateLimiter } from "../../../src/modules/contact/contact.rate-limit.js";

function createTestApp(now: () => number) {
  const limiter = createContactRateLimiter(
    { maxSubmissions: 1, maxTrackedKeys: 2, windowMs: 60_000 },
    { now },
  );
  const app = express();
  app.set("trust proxy", true);
  app.post("/contact", limiter.middleware, (_req, res) => res.sendStatus(204));
  return app;
}

const postFrom = (app: express.Express, ip: string) =>
  request(app).post("/contact").set("x-forwarded-for", ip);

describe("contact.rate-limit", () => {
  it("fails closed without evicting limited identities at capacity", async () => {
    const app = createTestApp(() => 10_000);

    expect((await postFrom(app, "203.0.113.1")).status).toBe(204);
    expect((await postFrom(app, "203.0.113.1")).status).toBe(429);
    expect((await postFrom(app, "203.0.113.2")).status).toBe(204);
    expect((await postFrom(app, "203.0.113.3")).status).toBe(429);

    // Churn must not reset the first identity's still-active counter.
    expect((await postFrom(app, "203.0.113.1")).status).toBe(429);
  });

  it("purges expired identities before applying the tracked-key cap", async () => {
    let now = 10_000;
    const app = createTestApp(() => now);

    expect((await postFrom(app, "203.0.113.1")).status).toBe(204);
    expect((await postFrom(app, "203.0.113.1")).status).toBe(429);
    expect((await postFrom(app, "203.0.113.2")).status).toBe(204);
    expect((await postFrom(app, "203.0.113.3")).status).toBe(429);

    now += 60_000;
    expect((await postFrom(app, "203.0.113.3")).status).toBe(204);
  });
});
