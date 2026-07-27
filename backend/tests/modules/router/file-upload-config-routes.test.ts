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

  it.each([
    "/api/v1/config/file-upload-limits",
    "/api/v1/config/allowed-file-types",
  ])("forbids inactive actors on %s", async (path) => {
    const response = await request(app).get(path).set({
      "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
      "x-user-role": "teacher",
      "x-user-status": "suspended",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
