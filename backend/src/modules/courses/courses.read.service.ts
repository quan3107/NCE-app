/**
 * File: src/modules/courses/courses.read.service.ts
 * Purpose: Implement course read/query operations for controllers.
 * Why: Separates list/detail logic from enrollment actions while keeping files under guideline limits.
 */
import { EnrollmentRole, UserRole } from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";
import { courseIdParamsSchema } from "./courses.schema.js";
import { canManageCourse, createHttpError } from "./courses.shared.js";
import {
  type CourseWithRelations,
  type PublicCourseRow,
  toCourseSummary,
  toPublicCourseSummary,
} from "./courses.read.helpers.js";
import type {
  CourseDetailResponse,
  CourseListResponse,
  CourseManager,
} from "./courses.types.js";

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
  actor?: CourseManager,
): Promise<CourseListResponse> {
  if (!actor) {
    const courses = await prisma.$queryRaw<PublicCourseRow[]>`
      select
        id,
        title,
        description,
        schedule_json as "scheduleJson",
        owner_teacher_id as "ownerId",
        owner_name as "ownerName",
        active_student_count as "activeStudentCount",
        invited_student_count as "invitedStudentCount",
        teacher_count as "teacherCount",
        assignment_count as "assignmentCount",
        rubric_count as "rubricCount",
        learning_outcomes as "learningOutcomes",
        structure_summary as "structureSummary",
        prerequisites_summary as "prerequisitesSummary",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from public.courses_public
      order by created_at desc
    `;

    return {
      courses: courses.map(toPublicCourseSummary),
    };
  }

  const baseWhere = { deletedAt: null };
  // Authenticated requests scope courses by role, while admins see everything.
  const where =
    !actor || actor.role === UserRole.admin
      ? baseWhere
      : actor.role === UserRole.teacher
        ? {
            ...baseWhere,
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
          }
        : {
            ...baseWhere,
            enrollments: {
              some: {
                userId: actor.id,
                roleInCourse: EnrollmentRole.student,
                deletedAt: null,
                user: { deletedAt: null },
              },
            },
          };

  const courses = await prisma.course.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      scheduleJson: true,
      learningOutcomes: true,
      structureSummary: true,
      prerequisitesSummary: true,
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
      learningOutcomes: true,
      structureSummary: true,
      prerequisitesSummary: true,
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
