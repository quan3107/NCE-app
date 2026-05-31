/**
 * File: tests/modules/courses/courses.teachers.service.test.ts
 * Purpose: Verify course co-teacher management behavior.
 * Why: Co-teacher enrollment management must preserve owner-only controls and role invariants.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnrollmentRole,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/config/prismaClient.js", () => ({
  prisma: {
    course: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  addCoTeacherToCourse,
  listCoTeachersForCourse,
  removeCoTeacherFromCourse,
} = await import("../../../src/modules/courses/courses.teachers.service.js");

const courseId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const teacherId = "33333333-3333-4333-8333-333333333333";
const enrollmentId = "44444444-4444-4444-8444-444444444444";
const ownerActor = {
  id: ownerId,
  role: UserRole.teacher,
};
const adminActor = {
  id: "55555555-5555-4555-8555-555555555555",
  role: UserRole.admin,
};
const coTeacher = {
  id: teacherId,
  fullName: "Mina Park",
  email: "mina.park@example.com",
  role: UserRole.teacher,
  status: UserStatus.active,
};

describe("courses.teachers.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.course.findFirst.mockResolvedValue({
      id: courseId,
      ownerId,
      enrollments: [],
    });
  });

  it("lists active co-teacher enrollments for an owner", async () => {
    const enrolledAt = new Date("2026-05-31T00:00:00.000Z");
    prisma.course.findFirst.mockResolvedValueOnce({
      id: courseId,
      ownerId,
      enrollments: [
        {
          createdAt: enrolledAt,
          user: {
            id: coTeacher.id,
            fullName: coTeacher.fullName,
            email: coTeacher.email,
            status: coTeacher.status,
          },
        },
      ],
    });

    const result = await listCoTeachersForCourse({ courseId }, ownerActor);

    expect(result).toEqual({
      courseId,
      teachers: [
        {
          id: coTeacher.id,
          fullName: coTeacher.fullName,
          email: coTeacher.email,
          status: coTeacher.status,
          enrolledAt: enrolledAt.toISOString(),
        },
      ],
    });
  });

  it("reactivates a deleted teacher enrollment when an owner adds a co-teacher", async () => {
    const enrolledAt = new Date("2026-05-31T01:00:00.000Z");
    prisma.user.findFirst.mockResolvedValueOnce(coTeacher);
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: enrollmentId,
      deletedAt: new Date("2026-05-01T00:00:00.000Z"),
      roleInCourse: EnrollmentRole.teacher,
    });
    prisma.enrollment.upsert.mockResolvedValueOnce({
      createdAt: enrolledAt,
      user: {
        id: coTeacher.id,
        fullName: coTeacher.fullName,
        email: coTeacher.email,
        status: coTeacher.status,
      },
    });

    const result = await addCoTeacherToCourse(
      { courseId },
      { email: coTeacher.email },
      ownerActor,
    );

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId_userId: {
            courseId,
            userId: coTeacher.id,
          },
        },
        update: {
          deletedAt: null,
          roleInCourse: EnrollmentRole.teacher,
        },
        create: {
          courseId,
          userId: coTeacher.id,
          roleInCourse: EnrollmentRole.teacher,
        },
      }),
    );
    expect(result).toEqual({
      id: coTeacher.id,
      fullName: coTeacher.fullName,
      email: coTeacher.email,
      status: coTeacher.status,
      enrolledAt: enrolledAt.toISOString(),
    });
  });

  it("rejects non-teacher accounts when adding co-teachers", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      ...coTeacher,
      role: UserRole.student,
    });

    await expect(
      addCoTeacherToCourse({ courseId }, { email: coTeacher.email }, adminActor),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Teacher account not found",
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("prevents co-teacher endpoints from removing the course owner", async () => {
    await expect(
      removeCoTeacherFromCourse({ courseId, teacherId: ownerId }, ownerActor),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Course owner cannot be removed as a co-teacher",
    });

    expect(prisma.enrollment.update).not.toHaveBeenCalled();
  });
});
