/**
 * File: tests/app.cors.test.ts
 * Purpose: Verify credentialed CORS only allows configured browser origins.
 * Why: Prevents cookie-capable responses from reflecting arbitrary origins.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("credentialed CORS allowlist", () => {
  it("allows configured browser origins on preflight requests", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not reflect unknown browser origins on preflight requests", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://attacker.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("does not emit browser CORS headers for server-to-server preflight requests", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
