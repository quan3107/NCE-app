/**
 * File: tests/modules/courses/courses.detail-completion.test.ts
 * Purpose: Validate backend completion-rate metrics for course detail responses.
 * Why: Prevents regressions where teacher completion rate drifts from live submissions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, Prisma } from "../../../src/prisma/index.js";
import {
  EnrollmentRole,
  SubmissionStatus,
  UserRole,
  UserStatus,
} from "../../../src/prisma/index.js";

vi.mock("../../../src/config/prismaClient.js", () => ({
  prisma: {
    course: {
      findFirst: vi.fn(),
    },
    enrollment: {
      count: vi.fn(),
    },
    assignment: {
      count: vi.fn(),
    },
    submission: {
      count: vi.fn(),
    },
  },
}));

const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { getCourseById } = await import(
  "../../../src/modules/courses/courses.read.service.js"
);

type CourseWithRelations = Course & {
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  enrollments: Array<{
    roleInCourse: EnrollmentRole;
    userId: string;
    user: {
      status: UserStatus;
    };
  }>;
  _count: {
    assignments: number;
    rubrics: number;
  };
};

const buildCourse = (
  overrides: Partial<CourseWithRelations> = {},
): CourseWithRelations => ({
  id: "00000000-0000-0000-0000-000000000000",
  title: "Default Course",
  description: null,
  learningOutcomes: null,
  structureSummary: null,
  prerequisitesSummary: null,
  scheduleJson: {} as Prisma.JsonValue,
  ownerId: "10000000-0000-0000-0000-000000000000",
  owner: {
    id: "10000000-0000-0000-0000-000000000000",
    fullName: "Owner Teacher",
    email: "owner.teacher@example.com",
  },
  enrollments: [],
  _count: {
    assignments: 0,
    rubrics: 0,
  },
  createdAt: new Date("2026-02-23T10:00:00.000Z"),
  updatedAt: new Date("2026-02-23T10:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("courses.read.service.getCourseById completion metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns completionRatePercent from submission-based formula", async () => {
    const courseId = "11111111-1111-4111-8111-111111111111";
    const ownerId = "22222222-2222-2222-2222-222222222222";
    prisma.course.findFirst.mockResolvedValueOnce(
      buildCourse({
        id: courseId,
        ownerId,
        owner: {
          id: ownerId,
          fullName: "Teacher Owner",
          email: "teacher.owner@example.com",
        },
      }),
    );
    prisma.enrollment.count.mockResolvedValueOnce(4);
    prisma.assignment.count.mockResolvedValueOnce(5);
    prisma.submission.count.mockResolvedValueOnce(12);

    const result = await getCourseById(
      { courseId },
      { id: ownerId, role: UserRole.teacher },
    );

    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: {
        courseId,
        roleInCourse: EnrollmentRole.student,
        deletedAt: null,
        user: {
          deletedAt: null,
          status: UserStatus.active,
        },
      },
    });
    expect(prisma.assignment.count).toHaveBeenCalledWith({
      where: {
        courseId,
        deletedAt: null,
        publishedAt: {
          not: null,
        },
      },
    });
    expect(prisma.submission.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: {
          in: [
            SubmissionStatus.submitted,
            SubmissionStatus.late,
            SubmissionStatus.graded,
          ],
        },
        assignment: {
          courseId,
          deletedAt: null,
          publishedAt: {
            not: null,
          },
        },
        student: {
          deletedAt: null,
          status: UserStatus.active,
          enrollments: {
            some: {
              courseId,
              roleInCourse: EnrollmentRole.student,
              deletedAt: null,
            },
          },
        },
      },
    });
    expect(result.metrics.completionRatePercent).toBe(60);
  });

  it("returns 0 when no active-student assignments are expected", async () => {
    const courseId = "33333333-3333-4333-8333-333333333333";
    const ownerId = "44444444-4444-4444-4444-444444444444";
    prisma.course.findFirst.mockResolvedValueOnce(
      buildCourse({
        id: courseId,
        ownerId,
        owner: {
          id: ownerId,
          fullName: "Teacher Owner",
          email: "teacher.owner@example.com",
        },
      }),
    );
    prisma.enrollment.count.mockResolvedValueOnce(0);
    prisma.assignment.count.mockResolvedValueOnce(5);
    prisma.submission.count.mockResolvedValueOnce(3);

    const result = await getCourseById(
      { courseId },
      { id: ownerId, role: UserRole.teacher },
    );

    expect(result.metrics.completionRatePercent).toBe(0);
  });

  it("caps completionRatePercent at 100 for inconsistent overcounts", async () => {
    const courseId = "55555555-5555-4555-8555-555555555555";
    const ownerId = "66666666-6666-6666-6666-666666666666";
    prisma.course.findFirst.mockResolvedValueOnce(
      buildCourse({
        id: courseId,
        ownerId,
        owner: {
          id: ownerId,
          fullName: "Teacher Owner",
          email: "teacher.owner@example.com",
        },
      }),
    );
    prisma.enrollment.count.mockResolvedValueOnce(1);
    prisma.assignment.count.mockResolvedValueOnce(1);
    prisma.submission.count.mockResolvedValueOnce(9);

    const result = await getCourseById(
      { courseId },
      { id: ownerId, role: UserRole.teacher },
    );

    expect(result.metrics.completionRatePercent).toBe(100);
  });
});
