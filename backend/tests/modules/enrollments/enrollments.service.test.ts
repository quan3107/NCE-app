/**
 * File: tests/modules/enrollments/enrollments.service.test.ts
 * Purpose: Verify enrollment write-side validation rules.
 * Why: Keeps course rosters aligned with account roles and lifecycle states.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnrollmentRole,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    course: {
      findFirst: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { createEnrollment } = await import(
  "../../../src/modules/enrollments/enrollments.service.js"
);

const courseId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const studentEnrollmentPayload = {
  courseId,
  userId,
  roleInCourse: EnrollmentRole.student,
};

const buildEnrollment = (
  roleInCourse: EnrollmentRole,
  userRole: UserRole,
) => ({
  id: "33333333-3333-4333-8333-333333333333",
  courseId,
  userId,
  roleInCourse,
  createdAt: new Date("2026-05-29T00:00:00.000Z"),
  updatedAt: new Date("2026-05-29T00:00:00.000Z"),
  user: {
    id: userId,
    fullName: "Amelia Chan",
    email: "amelia.chan@example.com",
    role: userRole,
    status: UserStatus.active,
  },
  course: {
    id: courseId,
    title: "IELTS Writing Intensive",
  },
});

describe("enrollments.service.createEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.course.findFirst.mockResolvedValue({ id: courseId });
  });

  it("creates a student enrollment for an active student", async () => {
    const createdEnrollment = buildEnrollment(
      EnrollmentRole.student,
      UserRole.student,
    );
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.student,
      status: UserStatus.active,
    });
    prisma.enrollment.findUnique.mockResolvedValueOnce(null);
    prisma.enrollment.upsert.mockResolvedValueOnce(createdEnrollment);

    const result = await createEnrollment(studentEnrollmentPayload);

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId_userId: {
            courseId,
            userId,
          },
        },
        update: {
          deletedAt: null,
          roleInCourse: EnrollmentRole.student,
        },
        create: {
          courseId,
          userId,
          roleInCourse: EnrollmentRole.student,
        },
      }),
    );
    expect(result).toBe(createdEnrollment);
  });

  it("creates a teacher enrollment for an active teacher", async () => {
    const teacherEnrollmentPayload = {
      ...studentEnrollmentPayload,
      roleInCourse: EnrollmentRole.teacher,
    };
    const createdEnrollment = buildEnrollment(
      EnrollmentRole.teacher,
      UserRole.teacher,
    );
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.teacher,
      status: UserStatus.active,
    });
    prisma.enrollment.findUnique.mockResolvedValueOnce(null);
    prisma.enrollment.upsert.mockResolvedValueOnce(createdEnrollment);

    const result = await createEnrollment(teacherEnrollmentPayload);

    expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId_userId: {
            courseId,
            userId,
          },
        },
        update: {
          deletedAt: null,
          roleInCourse: EnrollmentRole.teacher,
        },
        create: {
          courseId,
          userId,
          roleInCourse: EnrollmentRole.teacher,
        },
      }),
    );
    expect(result).toBe(createdEnrollment);
  });

  it("rejects a teacher enrolled with the student course role", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.teacher,
      status: UserStatus.active,
    });

    await expect(createEnrollment(studentEnrollmentPayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Enrollment role must match the user's account role.",
      details: {
        code: "invalid_role_pairing",
        expectedRole: UserRole.student,
        actualRole: UserRole.teacher,
      },
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("rejects a student enrolled with the teacher course role", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.student,
      status: UserStatus.active,
    });

    await expect(
      createEnrollment({
        ...studentEnrollmentPayload,
        roleInCourse: EnrollmentRole.teacher,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Enrollment role must match the user's account role.",
      details: {
        code: "invalid_role_pairing",
        expectedRole: UserRole.teacher,
        actualRole: UserRole.student,
      },
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("rejects a suspended user before creating an enrollment", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.student,
      status: UserStatus.suspended,
    });

    await expect(createEnrollment(studentEnrollmentPayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Suspended users cannot be enrolled in courses.",
      details: {
        code: "invalid_role_pairing",
        actualStatus: UserStatus.suspended,
      },
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("returns a conflict for a duplicate active enrollment", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.student,
      status: UserStatus.active,
    });
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: "33333333-3333-4333-8333-333333333333",
      deletedAt: null,
    });

    await expect(createEnrollment(studentEnrollmentPayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Enrollment already exists",
      details: {
        code: "duplicate_active_enrollment",
      },
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("revalidates role compatibility before reactivating a deleted enrollment", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: userId,
      role: UserRole.teacher,
      status: UserStatus.active,
    });
    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: "33333333-3333-4333-8333-333333333333",
      deletedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    await expect(createEnrollment(studentEnrollmentPayload)).rejects.toMatchObject({
      statusCode: 409,
      details: {
        code: "invalid_role_pairing",
      },
    });

    expect(prisma.enrollment.upsert).not.toHaveBeenCalled();
  });
});
