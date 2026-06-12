/**
 * File: tests/modules/audit-logs/audit-logs.routes.test.ts
 * Purpose: Verify audit log reads stay admin-only.
 * Why: Audit history can expose sensitive operational metadata.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("audit log routes", () => {
  it("requires authentication for GET /api/v1/audit-logs", async () => {
    const response = await request(app).get("/api/v1/audit-logs");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("forbids non-admin users from reading audit logs", async () => {
    const response = await request(app)
      .get("/api/v1/audit-logs")
      .set({
        "x-user-id": "16aa4673-381c-4316-86a4-3f0086550967",
        "x-user-role": "teacher",
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
