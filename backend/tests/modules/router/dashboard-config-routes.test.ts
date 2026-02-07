/**
 * File: tests/modules/router/dashboard-config-routes.test.ts
 * Purpose: Verify dashboard config endpoints are mounted on the API router.
 * Why: Prevents route composition regressions for dashboard widget configuration APIs.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router dashboard config routes", () => {
  it("mounts GET /api/v1/config/dashboard-widgets", async () => {
    const response = await request(app).get("/api/v1/config/dashboard-widgets");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts GET /api/v1/me/dashboard-config", async () => {
    const response = await request(app).get("/api/v1/me/dashboard-config");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts PUT /api/v1/me/dashboard-config", async () => {
    const response = await request(app)
      .put("/api/v1/me/dashboard-config")
      .send({ widgets: [] });

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts DELETE /api/v1/me/dashboard-config", async () => {
    const response = await request(app).delete("/api/v1/me/dashboard-config");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
