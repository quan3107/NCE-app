/**
 * File: tests/modules/router/nce-content-authoring-routes.test.ts
 * Purpose: Verify NCE authoring routes are mounted with auth.
 * Why: Keeps Express route wiring aligned with teacher/admin lesson workflows.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/modules/nce-content/nce-content.service.js", () => ({
  getNceLesson: vi.fn(async () => ({ id: lessonId, exercises: [] })),
  listCourseNceLessons: vi.fn(async () => ({ lessons: [], pagination: { page: 1, pageSize: 20, total: 0 } })),
  listNceBooks: vi.fn(async () => ({ books: [] })),
  listNceLessons: vi.fn(async () => ({ lessons: [], pagination: { page: 1, pageSize: 20, total: 0 } })),
  listNceUnits: vi.fn(async () => ({ units: [] })),
}));

vi.mock("../../../src/modules/nce-content/nce-content-authoring.service.js", () => ({
  assignNceLessonsToCourse: vi.fn(async () => ({ courseId, assignedCount: 1 })),
  createNceLesson: vi.fn(async () => ({ id: lessonId, status: "draft" })),
  patchNceLesson: vi.fn(async () => ({ id: lessonId, status: "draft" })),
  publishNceLesson: vi.fn(async () => ({ id: lessonId, status: "published" })),
  unpublishNceLesson: vi.fn(async () => ({ id: lessonId, status: "draft" })),
}));

const authoringService = await import("../../../src/modules/nce-content/nce-content-authoring.service.js");
const { app } = await import("../../../src/app.js");

const actorId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const lessonId = "33333333-3333-4333-8333-333333333333";

const asRole = (role: UserRole) => ({
  "x-user-id": actorId,
  "x-user-role": role,
});

describe("modules.router NCE authoring routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth to create NCE lessons", async () => {
    const response = await request(app).post("/api/v1/nce/lessons").send({});

    expect(response.status).toBe(401);
    expect(authoringService.createNceLesson).not.toHaveBeenCalled();
  });

  it("passes teacher actors to lesson create and patch services", async () => {
    const createResponse = await request(app)
      .post("/api/v1/nce/lessons")
      .set(asRole(UserRole.teacher))
      .send({ title: "Too late" });
    const patchResponse = await request(app)
      .patch(`/api/v1/nce/lessons/${lessonId}`)
      .set(asRole(UserRole.teacher))
      .send({ title: "Too late!" });

    expect(createResponse.status).toBe(201);
    expect(patchResponse.status).toBe(200);
    expect(authoringService.createNceLesson).toHaveBeenCalledWith(
      { title: "Too late" },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
    );
    expect(authoringService.patchNceLesson).toHaveBeenCalledWith(
      { lessonId },
      { title: "Too late!" },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
    );
  });

  it("mounts publish, unpublish, and course assignment endpoints", async () => {
    const publishResponse = await request(app)
      .post(`/api/v1/nce/lessons/${lessonId}/publish`)
      .set(asRole(UserRole.admin))
      .send();
    const unpublishResponse = await request(app)
      .post(`/api/v1/nce/lessons/${lessonId}/unpublish`)
      .set(asRole(UserRole.admin))
      .send();
    const assignResponse = await request(app)
      .put(`/api/v1/courses/${courseId}/nce-lessons`)
      .set(asRole(UserRole.teacher))
      .send({ lessons: [{ lessonId, sequence: 1 }] });

    expect(publishResponse.status).toBe(200);
    expect(unpublishResponse.status).toBe(200);
    expect(assignResponse.status).toBe(200);
    expect(authoringService.publishNceLesson).toHaveBeenCalledWith(
      { lessonId },
      { id: actorId, role: UserRole.admin, status: UserStatus.active },
    );
    expect(authoringService.unpublishNceLesson).toHaveBeenCalledWith(
      { lessonId },
      { id: actorId, role: UserRole.admin, status: UserStatus.active },
    );
    expect(authoringService.assignNceLessonsToCourse).toHaveBeenCalledWith(
      { courseId },
      { lessons: [{ lessonId, sequence: 1 }] },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
    );
  });
});
