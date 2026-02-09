/**
 * File: tests/modules/router/notification-config-routes.test.ts
 * Purpose: Verify notification type config endpoint is mounted on the API router.
 * Why: Prevents route composition regressions for notification config APIs.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router notification config routes", () => {
  it("mounts GET /api/v1/config/notification-types", async () => {
    const response = await request(app).get("/api/v1/config/notification-types");

    expect(response.status).not.toBe(404);
  });
});
