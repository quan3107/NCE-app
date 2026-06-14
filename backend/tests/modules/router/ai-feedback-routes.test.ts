/**
 * File: tests/modules/router/ai-feedback-routes.test.ts
 * Purpose: Verify AI feedback health routes are mounted and admin-only.
 * Why: Prevents AI provider readiness details from leaking to non-admin users.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

const activeAdminHeaders = {
  "x-user-id": "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2",
  "x-user-role": "admin",
};

describe("modules.router ai feedback routes", () => {
  it("requires authentication for GET /api/v1/ai-feedback/health", async () => {
    const response = await request(app).get("/api/v1/ai-feedback/health");

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("forbids non-admin users from health details", async () => {
    const response = await request(app)
      .get("/api/v1/ai-feedback/health")
      .set({
        "x-user-id": "16aa4673-381c-4316-86a4-3f0086550967",
        "x-user-role": "teacher",
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("returns disabled AI health metadata to active admins by default", async () => {
    const response = await request(app)
      .get("/api/v1/ai-feedback/health")
      .set(activeAdminHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "disabled",
      enabled: false,
      provider: {
        name: "openai-compatible",
        base_url: "https://api.openai.com/v1",
        health_path: "/models",
      },
      routes: {
        low_cost: {
          model: "gpt-5.4-nano",
          reasoning_effort: "medium",
        },
        premium: {
          model: "gpt-5.4-mini",
          reasoning_effort: "high",
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("api_key");
  });

  it("mounts the on-demand objective explanation request route", async () => {
    const response = await request(app).post(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts the on-demand objective explanation polling route", async () => {
    const response = await request(app).get(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/questions/q1/ai-explanation",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts the manual writing feedback generation route", async () => {
    const response = await request(app).post(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts the writing feedback polling route", async () => {
    const response = await request(app).get(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts the writing feedback draft history route", async () => {
    const response = await request(app).get(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing/drafts",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it.each(["approve", "reject", "finalize"])(
    "mounts the writing feedback %s review route",
    async (action) => {
      const response = await request(app).post(
        `/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing/drafts/22222222-2222-4222-8222-222222222222/${action}`,
      );

      expect(response.status).not.toBe(404);
      expect(response.status).toBe(401);
    },
  );

  it("mounts the writing feedback regeneration route", async () => {
    const response = await request(app).post(
      "/api/v1/submissions/11111111-1111-4111-8111-111111111111/ai-feedback/writing/regenerate",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts the assignment writing feedback batch route", async () => {
    const response = await request(app).post(
      "/api/v1/courses/77777777-7777-4777-8777-777777777777/assignments/22222222-2222-4222-8222-222222222222/ai-feedback/writing/batch",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
