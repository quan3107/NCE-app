/**
 * File: src/modules/courses/courses.read.service.ts
 * Purpose: Implement course read/query operations for controllers.
 * Why: Separates list/detail logic from enrollment actions while keeping files under guideline limits.
 */
import { EnrollmentRole, UserRole, UserStatus } from "@prisma/client";

import { prisma } from "../../config/prismaClient.js";
import { courseIdParamsSchema } from "./courses.schema.js";
import {
  canManageCourse,
  createHttpError,
} from "./courses.shared.js";
import type {
  CourseDetailResponse,
  CourseListResponse,
  CourseManager,
  CourseMetrics,
  CourseSummary,
} from "./courses.types.js";

type CourseWithRelations = {
  id: string;
  title: string;
  description: string | null;
  scheduleJson: unknown;
  ownerId: string;
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
  createdAt: Date;
  updatedAt: Date;
};

const parseSchedule = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const courseMetricsFromEnrollments = (
  course: CourseWithRelations,
): CourseMetrics => {
  const metrics: CourseMetrics = {
    activeStudentCount: 0,
    invitedStudentCount: 0,
    teacherCount: 0,
    assignmentCount: course._count.assignments,
    rubricCount: course._count.rubrics,
  };

  for (const enrollment of course.enrollments) {
    if (enrollment.roleInCourse === EnrollmentRole.student) {
      if (enrollment.user.status === UserStatus.invited) {
        metrics.invitedStudentCount += 1;
      } else {
        metrics.activeStudentCount += 1;
      }
      continue;
    }

    if (enrollment.roleInCourse === EnrollmentRole.teacher) {
      metrics.teacherCount += 1;
    }
  }

  return metrics;
};

const toCourseSummary = (course: CourseWithRelations): CourseSummary => ({
  id: course.id,
  title: course.title,
  description: course.description,
  schedule: parseSchedule(course.scheduleJson),
  owner: course.owner,
  metrics: courseMetricsFromEnrollments(course),
  createdAt: course.createdAt.toISOString(),
  updatedAt: course.updatedAt.toISOString(),
});

const teacherCanAccess = (
  course: CourseWithRelations,
  actor: CourseManager,
): boolean =>
  course.enrollments.some(
    (enrollment) =>
      enrollment.roleInCourse === EnrollmentRole.teacher &&
      enrollment.userId === actor.id,
  );

export async function listCourses(
  actor: CourseManager,
): Promise<CourseListResponse> {
  if (actor.role === UserRole.student) {
    throw createHttpError(403, "Students cannot list courses.");
  }

  const courses = await prisma.course.findMany({
    where:
      actor.role === UserRole.admin
        ? { deletedAt: null }
        : {
            deletedAt: null,
            OR: [
              { ownerId: actor.id },
              {
                enrollments: {
                  some: {
                    userId: actor.id,
                    roleInCourse: EnrollmentRole.teacher,
                    deletedAt: null,
                  },
                },
              },
            ],
          },
    select: {
      id: true,
      title: true,
      description: true,
      scheduleJson: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      enrollments: {
        where: {
          deletedAt: null,
          user: { deletedAt: null },
        },
        select: {
          roleInCourse: true,
          userId: true,
          user: {
            select: {
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          assignments: {
            where: { deletedAt: null },
          },
          rubrics: {
            where: { deletedAt: null },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    courses: courses.map((course) =>
      toCourseSummary(course as CourseWithRelations),
    ),
  };
}

export async function getCourseById(
  params: unknown,
  actor: CourseManager,
): Promise<CourseDetailResponse> {
  const { courseId } = courseIdParamsSchema.parse(params);

  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      scheduleJson: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      enrollments: {
        where: {
          deletedAt: null,
          user: { deletedAt: null },
        },
        select: {
          roleInCourse: true,
          userId: true,
          user: {
            select: {
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          assignments: {
            where: { deletedAt: null },
          },
          rubrics: {
            where: { deletedAt: null },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (
    !canManageCourse(course.ownerId, actor) &&
    !(actor.role === UserRole.teacher && teacherCanAccess(course as CourseWithRelations, actor))
  ) {
    throw createHttpError(
      403,
      "You do not have permission to manage this course",
    );
  }

  return toCourseSummary(course as CourseWithRelations);
}
