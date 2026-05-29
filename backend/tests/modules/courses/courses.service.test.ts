/**
 * File: tests/modules/courses/courses.service.test.ts
 * Purpose: Verify course write-side validation rules.
 * Why: Prevents impossible course ownership states from being persisted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole, UserStatus } from "../../../src/prisma/index.js";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    course: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { createCourse } = await import(
  "../../../src/modules/courses/courses.service.js"
);

const validCoursePayload = {
  title: "IELTS Writing Intensive",
  ownerTeacherId: "11111111-1111-4111-8111-111111111111",
};

describe("courses.service.createCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a student as the course owner", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: validCoursePayload.ownerTeacherId,
      role: UserRole.student,
      status: UserStatus.active,
    });

    await expect(createCourse(validCoursePayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Course owner must be an active teacher.",
      details: {
        code: "invalid_role_pairing",
        expectedRole: UserRole.teacher,
        actualRole: UserRole.student,
      },
    });

    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it("rejects a suspended teacher as the course owner", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: validCoursePayload.ownerTeacherId,
      role: UserRole.teacher,
      status: UserStatus.suspended,
    });

    await expect(createCourse(validCoursePayload)).rejects.toMatchObject({
      statusCode: 409,
      message: "Course owner must be an active teacher.",
      details: {
        code: "invalid_role_pairing",
        expectedStatus: UserStatus.active,
        actualStatus: UserStatus.suspended,
      },
    });

    expect(prisma.course.create).not.toHaveBeenCalled();
  });
});
