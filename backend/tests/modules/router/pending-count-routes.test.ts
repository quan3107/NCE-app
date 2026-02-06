/**
 * File: tests/modules/router/pending-count-routes.test.ts
 * Purpose: Verify pending-count endpoints are mounted on the API router.
 * Why: Guards against route wiring regressions when composing top-level routers.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("modules.router pending-count routes", () => {
  it("mounts GET /api/v1/assignments/pending-count", async () => {
    const response = await request(app).get("/api/v1/assignments/pending-count");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts GET /api/v1/submissions/pending-count", async () => {
    const response = await request(app).get("/api/v1/submissions/pending-count");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
