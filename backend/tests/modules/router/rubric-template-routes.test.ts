/**
 * File: tests/modules/router/rubric-template-routes.test.ts
 * Purpose: Verify rubric template endpoints are mounted on the API router.
 * Why: Guards against routing regressions when composing new backend template APIs.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

const validCourseId = "7f6c9f72-1e95-4f36-8f06-0f0a9ed0b1c2";

describe("modules.router rubric template routes", () => {
  it("mounts GET /api/v1/config/default-rubrics", async () => {
    const response = await request(app).get(
      "/api/v1/config/default-rubrics?context=grading&assignmentType=writing",
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts GET /api/v1/courses/:courseId/default-rubric-template", async () => {
    const response = await request(app).get(
      `/api/v1/courses/${validCourseId}/default-rubric-template`,
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });

  it("mounts GET /api/v1/rubrics/templates", async () => {
    const response = await request(app).get(
      `/api/v1/rubrics/templates?courseId=${validCourseId}`,
    );

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
