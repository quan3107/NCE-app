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

  it("forbids inactive actors", async () => {
    const response = await request(app)
      .get("/api/v1/config/course-management-tabs")
      .set({
        "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
        "x-user-role": "teacher",
        "x-user-status": "suspended",
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
