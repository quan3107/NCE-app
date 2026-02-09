/**
 * File: tests/modules/router/ielts-type-metadata-routes.test.ts
 * Purpose: Verify IELTS type metadata endpoint is mounted on the API router.
 * Why: Prevents router composition regressions for section 10 config API.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router ielts type metadata routes", () => {
  it("mounts GET /api/v1/config/ielts/type-metadata", async () => {
    const response = await request(app).get("/api/v1/config/ielts/type-metadata");

    expect(response.status).not.toBe(404);
  });
});
