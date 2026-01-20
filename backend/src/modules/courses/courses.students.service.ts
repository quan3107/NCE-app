/**
 * File: src/modules/courses/courses.students.service.ts
 * Purpose: Manage course enrollment operations (list/add/remove students).
 * Why: Keeps roster logic isolated from general course reads for clarity.
 */
import { EnrollmentRole, UserRole, UserStatus } from "@prisma/client";

import { prisma } from "../../config/prismaClient.js";
import {
  addCourseStudentSchema,
  courseIdParamsSchema,
  courseStudentParamsSchema,
} from "./courses.schema.js";
import {
  createHttpError,
  ensureCourseAccessible,
} from "./courses.shared.js";
import type {
  CourseManager,
  CourseStudent,
  CourseStudentsResponse,
} from "./courses.types.js";

const toCourseStudent = (input: {
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: UserStatus;
  };
}): CourseStudent => ({
  id: input.user.id,
  fullName: input.user.fullName,
  email: input.user.email,
  status: input.user.status,
  enrolledAt: input.createdAt.toISOString(),
});

export async function listStudentsForCourse(
  params: unknown,
  actor: CourseManager,
): Promise<CourseStudentsResponse> {
  const { courseId } = courseIdParamsSchema.parse(params);

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
    },
    select: {
      id: true,
      ownerId: true,
      enrollments: {
        where: {
          roleInCourse: EnrollmentRole.student,
          deletedAt: null,
          user: {
            deletedAt: null,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (actor.role === UserRole.teacher && course.ownerId !== actor.id) {
    const teacherEnrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        userId: actor.id,
        roleInCourse: EnrollmentRole.teacher,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!teacherEnrollment) {
      throw createHttpError(
        403,
        "You do not have permission to manage this course",
      );
    }
  }

  const students = course.enrollments
    .map((enrollment) => {
      if (!enrollment.user) {
        return null;
      }
      return toCourseStudent(enrollment);
    })
    .filter((value): value is CourseStudent => value !== null);

  return {
    courseId: course.id,
    students,
  };
}

export async function addStudentToCourse(
  params: unknown,
  payload: unknown,
  actor: CourseManager,
): Promise<CourseStudent> {
  const { courseId } = courseIdParamsSchema.parse(params);
  const { email } = addCourseStudentSchema.parse(payload);

  await ensureCourseAccessible(courseId, actor);

  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.role !== UserRole.student) {
    throw createHttpError(404, "Student account not found");
  }

  if (user.status === UserStatus.suspended) {
    throw createHttpError(409, "Student account is suspended");
  }

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId: user.id,
      },
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (existingEnrollment && !existingEnrollment.deletedAt) {
    throw createHttpError(409, "Student is already enrolled in this course");
  }

  const enrollment = existingEnrollment
    ? await prisma.enrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          deletedAt: null,
        },
        select: {
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
        },
      })
    : await prisma.enrollment.create({
        data: {
          courseId,
          userId: user.id,
          roleInCourse: EnrollmentRole.student,
        },
        select: {
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              status: true,
            },
          },
        },
      });

  if (!enrollment.user) {
    throw createHttpError(500, "Enrollment created without student");
  }

  return toCourseStudent(enrollment);
}

export async function removeStudentFromCourse(
  params: unknown,
  actor: CourseManager,
): Promise<void> {
  const { courseId, studentId } = courseStudentParamsSchema.parse(params);

  await ensureCourseAccessible(courseId, actor);

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId: studentId,
      },
    },
    select: {
      id: true,
      deletedAt: true,
      roleInCourse: true,
    },
  });

  if (!enrollment || enrollment.roleInCourse !== EnrollmentRole.student) {
    throw createHttpError(404, "Enrollment not found for the specified student");
  }

  if (enrollment.deletedAt) {
    return;
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      deletedAt: new Date(),
    },
  });
}
