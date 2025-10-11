/**
 * File: src/modules/courses/courses.service.ts
 * Purpose: Implement course-related business logic, including enrollment management.
 * Why: Keeps controllers thin while delegating data access, validation, and authorization to a single layer.
 */
import { EnrollmentRole, UserRole, UserStatus } from "@prisma/client";

import { prisma } from "../../config/prismaClient.js";
import {
  addCourseStudentSchema,
  courseIdParamsSchema,
  courseStudentParamsSchema,
  createCourseSchema,
} from "./courses.schema.js";

type HttpError = Error & {
  statusCode?: number;
  expose?: boolean;
  details?: unknown;
};

const createHttpError = (statusCode: number, message: string): HttpError => {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
};

const canManageCourse = (ownerId: string, actor: CourseManager): boolean =>
  actor.role === UserRole.admin ||
  (actor.role === UserRole.teacher && actor.id === ownerId);

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

async function ensureCourseAccessible(
  courseId: string,
  actor: CourseManager,
) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: { id: true, ownerId: true },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (!canManageCourse(course.ownerId, actor)) {
    throw createHttpError(
      403,
      "You do not have permission to manage this course",
    );
  }

  return course;
}

export type CourseStudent = {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  enrolledAt: string;
};

export type CourseStudentsResponse = {
  courseId: string;
  students: CourseStudent[];
};

export type CourseManager = {
  id: string;
  role: UserRole;
};

export async function listCourses(): Promise<void> {
  // Future implementation will paginate courses by teacher.
}

export async function getCourseById(params: unknown): Promise<void> {
  courseIdParamsSchema.parse(params);
}

export async function createCourse(payload: unknown): Promise<void> {
  createCourseSchema.parse(payload);
}

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

  if (!canManageCourse(course.ownerId, actor)) {
    throw createHttpError(
      403,
      "You do not have permission to manage this course",
    );
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

