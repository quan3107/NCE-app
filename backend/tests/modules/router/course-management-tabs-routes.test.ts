/**
 * File: tests/modules/router/course-management-tabs-routes.test.ts
 * Purpose: Verify course management tabs config endpoint is mounted on the API router.
 * Why: Prevents route composition regressions for course tab config APIs.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router course management tabs config routes", () => {
  it("mounts GET /api/v1/config/course-management-tabs", async () => {
    const response = await request(app).get("/api/v1/config/course-management-tabs");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
