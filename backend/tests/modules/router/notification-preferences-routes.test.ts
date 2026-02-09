/**
 * File: tests/modules/router/notification-preferences-routes.test.ts
 * Purpose: Verify notification preference endpoints are mounted on the API router.
 * Why: Prevents accidental route wiring regressions for teacher notification filters.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router notification preferences routes", () => {
  it("mounts GET /api/v1/me/notification-preferences", async () => {
    const response = await request(app).get(
      "/api/v1/me/notification-preferences",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts PUT /api/v1/me/notification-preferences", async () => {
    const response = await request(app)
      .put("/api/v1/me/notification-preferences")
      .send({ types: [{ id: "new_submission", enabled: false }] });

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts DELETE /api/v1/me/notification-preferences", async () => {
    const response = await request(app).delete(
      "/api/v1/me/notification-preferences",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
