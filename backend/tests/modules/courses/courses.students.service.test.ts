/**
 * File: tests/modules/courses/courses.students.service.test.ts
 * Purpose: Verify course roster write behavior.
 * Why: Keeps student roster mutations aligned with enrollment role invariants.
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

vi.mock("../../../src/modules/audit-logs/audit-logs.service.js", () => ({
  writeAuditLogSafely: vi.fn(),
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);
const auditLogsModule = await import(
  "../../../src/modules/audit-logs/audit-logs.service.js"
);
const writeAuditLogSafely = vi.mocked(auditLogsModule.writeAuditLogSafely);

const { addStudentToCourse, removeStudentFromCourse } = await import(
  "../../../src/modules/courses/courses.students.service.js"
);

const courseId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const adminActor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.admin,
};
const student = {
  id: studentId,
  fullName: "Amelia Chan",
  email: "amelia.chan@example.com",
  role: UserRole.student,
  status: UserStatus.active,
};
const enrollmentId = "55555555-5555-4555-8555-555555555555";

describe("courses.students.service.addStudentToCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.course.findFirst.mockResolvedValue({
      id: courseId,
      ownerId: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("resets the enrollment role when reactivating a deleted student enrollment", async () => {
    const enrolledAt = new Date("2026-05-29T00:00:00.000Z");
    prisma.user.findFirst.mockResolvedValueOnce(student);
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: enrollmentId,
      deletedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    prisma.enrollment.upsert.mockResolvedValueOnce({
      id: enrollmentId,
      createdAt: enrolledAt,
      user: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        status: student.status,
      },
    });

    const result = await addStudentToCourse(
      { courseId },
      { email: student.email },
      adminActor,
    );

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId_userId: {
            courseId,
            userId: student.id,
          },
        },
        update: {
          deletedAt: null,
          roleInCourse: EnrollmentRole.student,
        },
        create: {
          courseId,
          userId: student.id,
          roleInCourse: EnrollmentRole.student,
        },
      }),
    );
    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: adminActor.id,
      action: "course.student_added",
      entity: "enrollment",
      entityId: enrollmentId,
      before: {
        id: enrollmentId,
        deletedAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      after: {
        id: enrollmentId,
        courseId,
        studentId: student.id,
        roleInCourse: EnrollmentRole.student,
        deletedAt: null,
      },
    });
    expect(result).toEqual({
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      status: student.status,
      enrolledAt: enrolledAt.toISOString(),
    });
  });

  it("writes an audit log when removing a student enrollment", async () => {
    const removedAt = new Date("2026-05-30T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(removedAt);
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: enrollmentId,
      deletedAt: null,
      roleInCourse: EnrollmentRole.student,
    });
    prisma.enrollment.update.mockResolvedValueOnce({
      id: enrollmentId,
      deletedAt: removedAt,
      roleInCourse: EnrollmentRole.student,
    });

    await removeStudentFromCourse({ courseId, studentId }, adminActor);

    expect(writeAuditLogSafely).toHaveBeenCalledWith({
      actorId: adminActor.id,
      action: "course.student_removed",
      entity: "enrollment",
      entityId: enrollmentId,
      before: {
        id: enrollmentId,
        deletedAt: null,
        roleInCourse: EnrollmentRole.student,
      },
      after: {
        id: enrollmentId,
        courseId,
        studentId,
        roleInCourse: EnrollmentRole.student,
        deletedAt: removedAt,
      },
    });

    vi.useRealTimers();
  });
});
