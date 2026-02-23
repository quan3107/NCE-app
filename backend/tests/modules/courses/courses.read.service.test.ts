/**
 * File: tests/modules/courses/courses.read.service.test.ts
 * Purpose: Exercise the course listing service across roles to prevent regressions that block students.
 * Why: Guards against authorization mistakes like the 403 error students hit when attempting to fetch their courses.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Course, Prisma } from '../../../src/prisma/index.js';
import {
  EnrollmentRole,
  UserRole,
  UserStatus,
} from '../../../src/prisma/index.js';

vi.mock("../../../src/config/prismaClient.js", () => ({
  prisma: {
    course: {
      findMany: vi.fn(),
    },
  },
}));

// Use vi.mocked to surface typed helpers on the Prisma course delegate.
const prismaModule = await import("../../../src/config/prismaClient.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const { listCourses } = await import(
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

// Builder keeps Prisma delegate mocks satisfied with fully-shaped course records.
const buildCourse = (
  overrides: Partial<CourseWithRelations> = {},
): CourseWithRelations => ({
  id: "course-default",
  title: "Default Course",
  description: null,
  learningOutcomes: null,
  structureSummary: null,
  prerequisitesSummary: null,
  scheduleJson: {} as Prisma.JsonValue,
  ownerId: "teacher-default",
  owner: {
    id: "teacher-default",
    fullName: "Default Teacher",
    email: "teacher@example.com",
  },
  enrollments: [],
  _count: {
    assignments: 0,
    rubrics: 0,
  },
  createdAt: new Date("2025-10-12T00:00:00.000Z"),
  updatedAt: new Date("2025-10-12T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

describe("courses.read.service.listCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows students to list only the courses they are enrolled in", async () => {
    const now = new Date("2025-10-12T12:00:00.000Z");
    const scheduleJson: Prisma.JsonObject = {
      cadence: "weekly",
      start_time: "2025-10-15T11:00:00Z",
      duration_minutes: 90,
      time_zone: "Asia/Ho_Chi_Minh",
      format: "online",
      label: "Evening Cohort",
      duration: "8 weeks",
      level: "Intermediate",
      price: 450,
    };
    const course = buildCourse({
      id: "course-1",
      title: "IELTS Writing Intensive",
      description: "Focused prep for band 7 writing.",
      scheduleJson: scheduleJson as Prisma.JsonValue,
      ownerId: "teacher-1",
      owner: {
        id: "teacher-1",
        fullName: "Thao Nguyen",
        email: "thao.nguyen@example.com",
      },
      enrollments: [
        {
          roleInCourse: EnrollmentRole.teacher,
          userId: "teacher-1",
          user: { status: UserStatus.active },
        },
        {
          roleInCourse: EnrollmentRole.student,
          userId: "student-1",
          user: { status: UserStatus.active },
        },
        {
          roleInCourse: EnrollmentRole.student,
          userId: "student-2",
          user: { status: UserStatus.invited },
        },
      ],
      _count: {
        assignments: 5,
        rubrics: 2,
      },
      createdAt: now,
      updatedAt: now,
    });

    prisma.course.findMany.mockResolvedValueOnce([course]);

    const result = await listCourses({
      id: "student-1",
      role: UserRole.student,
    });

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          enrollments: {
            some: {
              userId: "student-1",
              roleInCourse: EnrollmentRole.student,
              deletedAt: null,
              user: { deletedAt: null },
            },
          },
        },
      }),
    );

    expect(result).toEqual({
      courses: [
        {
          id: course.id,
          title: course.title,
          description: course.description,
          learningOutcomes: null,
          structureSummary: null,
          prerequisitesSummary: null,
          schedule: {
            cadence: "weekly",
            startTime: "2025-10-15T11:00:00Z",
            durationMinutes: 90,
            timeZone: "Asia/Ho_Chi_Minh",
            format: "online",
            label: "Evening Cohort",
          },
          metadata: {
            duration: "8 weeks",
            level: "Intermediate",
            price: 450,
          },
          owner: course.owner,
          metrics: {
            activeStudentCount: 1,
            invitedStudentCount: 1,
            teacherCount: 1,
            assignmentCount: 5,
            rubricCount: 2,
            completionRatePercent: 0,
          },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });
  });
});
