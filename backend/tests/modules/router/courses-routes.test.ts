/**
 * File: tests/modules/router/courses-routes.test.ts
 * Purpose: Verify course management routes are mounted and wired to controllers.
 * Why: Protects co-teacher route permissions and controller/service handoff from regressions.
 */
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/modules/courses/courses.teachers.service.js", () => ({
  addCoTeacherToCourse: vi.fn(async () => ({
    id: teacherId,
    fullName: "Mina Park",
    email: "mina.park@example.com",
    status: UserStatus.active,
    enrolledAt: "2026-05-31T00:00:00.000Z",
  })),
  listCoTeachersForCourse: vi.fn(async () => ({
    courseId,
    teachers: [],
  })),
  removeCoTeacherFromCourse: vi.fn(async () => undefined),
}));

const teacherService = await import(
  "../../../src/modules/courses/courses.teachers.service.js"
);
const { app } = await import("../../../src/app.js");

const courseId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const teacherId = "33333333-3333-4333-8333-333333333333";

const asRole = (role: UserRole) => ({
  "x-user-id": actorId,
  "x-user-role": role,
});

describe("modules.router course co-teacher routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth for co-teacher endpoints", async () => {
    const responses = await Promise.all([
      request(app).get(`/api/v1/courses/${courseId}/teachers`),
      request(app)
        .post(`/api/v1/courses/${courseId}/teachers`)
        .send({ email: "mina.park@example.com" }),
      request(app).delete(`/api/v1/courses/${courseId}/teachers/${teacherId}`),
    ]);

    for (const response of responses) {
      expect(response.status).not.toBe(404);
      expect(response.status).toBe(401);
    }
    expect(teacherService.listCoTeachersForCourse).not.toHaveBeenCalled();
    expect(teacherService.addCoTeacherToCourse).not.toHaveBeenCalled();
    expect(teacherService.removeCoTeacherFromCourse).not.toHaveBeenCalled();
  });

  it("forbids students before reaching co-teacher services", async () => {
    const responses = await Promise.all([
      request(app)
        .get(`/api/v1/courses/${courseId}/teachers`)
        .set(asRole(UserRole.student)),
      request(app)
        .post(`/api/v1/courses/${courseId}/teachers`)
        .set(asRole(UserRole.student))
        .send({ email: "mina.park@example.com" }),
      request(app)
        .delete(`/api/v1/courses/${courseId}/teachers/${teacherId}`)
        .set(asRole(UserRole.student)),
    ]);

    for (const response of responses) {
      expect(response.status).not.toBe(404);
      expect(response.status).toBe(403);
    }
    expect(teacherService.listCoTeachersForCourse).not.toHaveBeenCalled();
    expect(teacherService.addCoTeacherToCourse).not.toHaveBeenCalled();
    expect(teacherService.removeCoTeacherFromCourse).not.toHaveBeenCalled();
  });

  it("passes authenticated actors and payloads to co-teacher services", async () => {
    const getResponse = await request(app)
      .get(`/api/v1/courses/${courseId}/teachers`)
      .set(asRole(UserRole.teacher));
    const postResponse = await request(app)
      .post(`/api/v1/courses/${courseId}/teachers`)
      .set(asRole(UserRole.admin))
      .send({ email: "mina.park@example.com" });
    const deleteResponse = await request(app)
      .delete(`/api/v1/courses/${courseId}/teachers/${teacherId}`)
      .set(asRole(UserRole.teacher));

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(204);
    expect(teacherService.listCoTeachersForCourse).toHaveBeenCalledWith(
      { courseId },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
    );
    expect(teacherService.addCoTeacherToCourse).toHaveBeenCalledWith(
      { courseId },
      { email: "mina.park@example.com" },
      { id: actorId, role: UserRole.admin, status: UserStatus.active },
    );
    expect(teacherService.removeCoTeacherFromCourse).toHaveBeenCalledWith(
      { courseId, teacherId },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
    );
  });
});
