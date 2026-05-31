/**
 * File: src/modules/courses/courses.teachers.service.ts
 * Purpose: Manage course co-teacher enrollment operations.
 * Why: Co-teacher access needs explicit owner/admin controls and role-safe enrollment updates.
 */
import { EnrollmentRole, UserRole, UserStatus } from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";
import {
  addCourseTeacherSchema,
  courseIdParamsSchema,
  courseTeacherParamsSchema,
} from "./courses.schema.js";
import {
  createHttpError,
  ensureCourseAccessible,
  getCourseAccessRole,
} from "./courses.shared.js";
import type {
  CourseManager,
  CourseTeacher,
  CourseTeachersResponse,
} from "./courses.types.js";

const toCourseTeacher = (input: {
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    status: UserStatus;
  };
}): CourseTeacher => ({
  id: input.user.id,
  fullName: input.user.fullName,
  email: input.user.email,
  status: input.user.status,
  enrolledAt: input.createdAt.toISOString(),
});

export async function listCoTeachersForCourse(
  params: unknown,
  actor: CourseManager,
): Promise<CourseTeachersResponse> {
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
          roleInCourse: EnrollmentRole.teacher,
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
          userId: true,
          roleInCourse: true,
          deletedAt: true,
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

  const accessRole = getCourseAccessRole(
    course.ownerId,
    course.enrollments,
    actor,
  );

  if (!["admin", "owner", "coTeacher"].includes(accessRole)) {
    throw createHttpError(403, "You do not have permission to access this course");
  }

  const teachers = course.enrollments
    .filter((enrollment) => enrollment.user.id !== course.ownerId)
    .map(toCourseTeacher);

  return {
    courseId: course.id,
    teachers,
  };
}

export async function addCoTeacherToCourse(
  params: unknown,
  payload: unknown,
  actor: CourseManager,
): Promise<CourseTeacher> {
  const { courseId } = courseIdParamsSchema.parse(params);
  const { email } = addCourseTeacherSchema.parse(payload);

  const course = await ensureCourseAccessible(courseId, actor);
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

  if (!user || user.role !== UserRole.teacher) {
    throw createHttpError(404, "Teacher account not found");
  }

  if (user.status !== UserStatus.active) {
    throw createHttpError(409, "Teacher account must be active");
  }

  if (user.id === course.ownerId) {
    throw createHttpError(409, "Course owner is already the owner teacher");
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
      roleInCourse: true,
    },
  });

  if (existingEnrollment && !existingEnrollment.deletedAt) {
    if (existingEnrollment.roleInCourse === EnrollmentRole.teacher) {
      throw createHttpError(409, "Teacher is already a co-teacher for this course");
    }
    throw createHttpError(
      409,
      "User is already enrolled in this course with a different role",
    );
  }

  const enrollment = await prisma.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId,
        userId: user.id,
      },
    },
    update: {
      deletedAt: null,
      roleInCourse: EnrollmentRole.teacher,
    },
    create: {
      courseId,
      userId: user.id,
      roleInCourse: EnrollmentRole.teacher,
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
    throw createHttpError(500, "Enrollment created without teacher");
  }

  return toCourseTeacher(enrollment);
}

export async function removeCoTeacherFromCourse(
  params: unknown,
  actor: CourseManager,
): Promise<void> {
  const { courseId, teacherId } = courseTeacherParamsSchema.parse(params);
  const course = await ensureCourseAccessible(courseId, actor);

  if (teacherId === course.ownerId) {
    throw createHttpError(409, "Course owner cannot be removed as a co-teacher");
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId: teacherId,
      },
    },
    select: {
      id: true,
      deletedAt: true,
      roleInCourse: true,
    },
  });

  if (!enrollment || enrollment.roleInCourse !== EnrollmentRole.teacher) {
    throw createHttpError(404, "Enrollment not found for the specified teacher");
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
