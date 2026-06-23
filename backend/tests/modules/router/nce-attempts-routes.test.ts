/**
 * File: tests/modules/router/nce-attempts-routes.test.ts
 * Purpose: Verify NCE learning routes are mounted behind auth.
 * Why: Keeps student and teacher attempt APIs aligned with Express route wiring.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/modules/nce-attempts/nce-attempts.service.js", () => ({
  completeNceLesson: vi.fn(async () => ({ status: "completed" })),
  createOrUpdateNceAttempt: vi.fn(async () => ({ id: attemptId, status: "draft" })),
  listStudentNcePath: vi.fn(async () => ({ lessons: [], pagination: { page: 1, pageSize: 20, total: 0 } })),
  listTeacherNceAttemptSummaries: vi.fn(async () => ({ attempts: [], pagination: { page: 1, pageSize: 20, total: 0 } })),
  submitNceAttempt: vi.fn(async () => ({ id: attemptId, status: "submitted" })),
}));

const nceAttemptsService = await import("../../../src/modules/nce-attempts/nce-attempts.service.js");
const { app } = await import("../../../src/app.js");

const actorId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const lessonId = "33333333-3333-4333-8333-333333333333";
const exerciseId = "44444444-4444-4444-8444-444444444444";
const attemptId = "55555555-5555-4555-8555-555555555555";

const asRole = (role: UserRole) => ({
  "x-user-id": actorId,
  "x-user-role": role,
});

describe("modules.router nce attempt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth for the student NCE path", async () => {
    const response = await request(app).get(`/api/v1/courses/${courseId}/nce-path`);

    expect(response.status).toBe(401);
    expect(nceAttemptsService.listStudentNcePath).not.toHaveBeenCalled();
  });

  it("passes student actors to NCE path and attempt mutations", async () => {
    const pathResponse = await request(app)
      .get(`/api/v1/courses/${courseId}/nce-path?page=2`)
      .set(asRole(UserRole.student));
    const attemptResponse = await request(app)
      .post(`/api/v1/courses/${courseId}/nce-exercises/${exerciseId}/attempts`)
      .set(asRole(UserRole.student))
      .send({ response: { answer: "this" } });
    const submitResponse = await request(app)
      .post(`/api/v1/nce-attempts/${attemptId}/submit`)
      .set(asRole(UserRole.student));
    const completeResponse = await request(app)
      .post(`/api/v1/courses/${courseId}/nce-lessons/${lessonId}/complete`)
      .set(asRole(UserRole.student));

    expect(pathResponse.status).toBe(200);
    expect(attemptResponse.status).toBe(200);
    expect(submitResponse.status).toBe(200);
    expect(completeResponse.status).toBe(200);
    expect(nceAttemptsService.listStudentNcePath).toHaveBeenCalledWith(
      { courseId },
      { id: actorId, role: UserRole.student, status: UserStatus.active },
      { page: "2" },
    );
    expect(nceAttemptsService.createOrUpdateNceAttempt).toHaveBeenCalledWith(
      { courseId, exerciseId },
      { response: { answer: "this" } },
      { id: actorId, role: UserRole.student, status: UserStatus.active },
    );
    expect(nceAttemptsService.submitNceAttempt).toHaveBeenCalledWith(
      { attemptId },
      { id: actorId, role: UserRole.student, status: UserStatus.active },
    );
    expect(nceAttemptsService.completeNceLesson).toHaveBeenCalledWith(
      { courseId, lessonId },
      { id: actorId, role: UserRole.student, status: UserStatus.active },
    );
  });

  it("passes teacher actors to NCE attempt summaries", async () => {
    const response = await request(app)
      .get(`/api/v1/courses/${courseId}/nce-attempts?studentId=${actorId}`)
      .set(asRole(UserRole.teacher));

    expect(response.status).toBe(200);
    expect(nceAttemptsService.listTeacherNceAttemptSummaries).toHaveBeenCalledWith(
      { courseId },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
      { studentId: actorId },
    );
  });
});
