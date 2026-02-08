/**
 * File: tests/modules/router/ielts-config-routes.test.ts
 * Purpose: Verify IELTS config endpoints are mounted on the API router.
 * Why: Guards against route composition regressions for IELTS configuration APIs.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router ielts config routes", () => {
  it("mounts GET /api/v1/config/ielts", async () => {
    const response = await request(app).get("/api/v1/config/ielts");

    expect(response.status).not.toBe(404);
  });

  it("mounts GET /api/v1/config/ielts/versions", async () => {
    const response = await request(app).get("/api/v1/config/ielts/versions");

    expect(response.status).not.toBe(404);
  });

  it("mounts GET /api/v1/config/ielts/question-options", async () => {
    const response = await request(app).get(
      "/api/v1/config/ielts/question-options?type=true_false",
    );

    expect(response.status).not.toBe(404);
  });
});
