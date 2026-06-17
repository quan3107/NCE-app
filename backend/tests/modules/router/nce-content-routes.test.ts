/**
 * File: tests/modules/router/nce-content-routes.test.ts
 * Purpose: Verify NCE content routes are mounted and pass actors to services.
 * Why: Prevents the read API from drifting away from Express auth wiring.
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

const nceService = await import("../../../src/modules/nce-content/nce-content.service.js");
const { app } = await import("../../../src/app.js");

const actorId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";
const unitId = "44444444-4444-4444-8444-444444444444";
const lessonId = "55555555-5555-4555-8555-555555555555";

const asRole = (role: UserRole) => ({
  "x-user-id": actorId,
  "x-user-role": role,
});

describe("modules.router nce content routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts public published NCE catalog routes", async () => {
    const booksResponse = await request(app).get("/api/v1/nce/books");
    const unitsResponse = await request(app).get(`/api/v1/nce/books/${bookId}/units`);
    const lessonsResponse = await request(app).get(`/api/v1/nce/units/${unitId}/lessons`);
    const lessonResponse = await request(app).get(`/api/v1/nce/lessons/${lessonId}`);

    expect(booksResponse.status).toBe(200);
    expect(unitsResponse.status).toBe(200);
    expect(lessonsResponse.status).toBe(200);
    expect(lessonResponse.status).toBe(200);
    expect(nceService.listNceBooks).toHaveBeenCalledWith(undefined, {});
    expect(nceService.listNceUnits).toHaveBeenCalledWith(
      { bookId },
      undefined,
      {},
    );
    expect(nceService.listNceLessons).toHaveBeenCalledWith(
      { unitId },
      undefined,
      {},
    );
    expect(nceService.getNceLesson).toHaveBeenCalledWith(
      { lessonId },
      undefined,
      {},
    );
  });

  it("requires auth for course-assigned NCE lessons", async () => {
    const response = await request(app).get(`/api/v1/courses/${courseId}/nce-lessons`);

    expect(response.status).toBe(401);
    expect(nceService.listCourseNceLessons).not.toHaveBeenCalled();
  });

  it("passes authenticated course actors to assigned lesson reads", async () => {
    const response = await request(app)
      .get(`/api/v1/courses/${courseId}/nce-lessons?includeDrafts=true`)
      .set(asRole(UserRole.teacher));

    expect(response.status).toBe(200);
    expect(nceService.listCourseNceLessons).toHaveBeenCalledWith(
      { courseId },
      { id: actorId, role: UserRole.teacher, status: UserStatus.active },
      { includeDrafts: "true" },
    );
  });
});
