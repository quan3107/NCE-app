/**
 * File: src/modules/courses/courses.service.ts
 * Purpose: Implement course-related business logic, including enrollment lookups.
 * Why: Keeps controllers thin while delegating data access and validation concerns.
 */
import { EnrollmentRole, type UserStatus } from "@prisma/client";

import { prisma } from "../../config/prismaClient.js";
import {
  courseIdParamsSchema,
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
): Promise<CourseStudentsResponse> {
  const { courseId } = courseIdParamsSchema.parse(params);

  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      deletedAt: null,
    },
    select: {
      id: true,
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

  const students = course.enrollments
    .map(({ createdAt, user }) => {
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
        enrolledAt: createdAt.toISOString(),
      };
    })
    .filter((value): value is CourseStudent => value !== null);

  return {
    courseId: course.id,
    students,
  };
}
