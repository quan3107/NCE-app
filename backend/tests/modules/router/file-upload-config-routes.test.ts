/**
 * File: tests/modules/router/file-upload-config-routes.test.ts
 * Purpose: Verify file upload config endpoints are mounted on the API router.
 * Why: Guards against route composition regressions for upload configuration APIs.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router file upload config routes", () => {
  it("mounts GET /api/v1/config/file-upload-limits", async () => {
    const response = await request(app).get("/api/v1/config/file-upload-limits");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts GET /api/v1/config/allowed-file-types", async () => {
    const response = await request(app).get("/api/v1/config/allowed-file-types");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
