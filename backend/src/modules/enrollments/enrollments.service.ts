/**
 * File: src/modules/enrollments/enrollments.service.ts
 * Purpose: Implement enrollment listing and creation logic using Prisma.
 * Why: Supports admin enrollment management endpoints required by the PRD.
 */
import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  createEnrollmentSchema,
  DEFAULT_ENROLLMENT_LIMIT,
  enrollmentIdParamsSchema,
  enrollmentQuerySchema,
} from "./enrollments.schema.js";

const enrollmentSelect = {
  id: true,
  courseId: true,
  userId: true,
  roleInCourse: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  },
  course: {
    select: {
      id: true,
      title: true,
    },
  },
};

export async function listEnrollments(query: unknown) {
  const filters = enrollmentQuerySchema.parse(query);
  const limit = filters.limit ?? DEFAULT_ENROLLMENT_LIMIT;
  const offset = filters.offset ?? 0;

  return prisma.enrollment.findMany({
    where: {
      deletedAt: null,
      courseId: filters.courseId,
      userId: filters.userId,
      roleInCourse: filters.roleInCourse,
      course: { deletedAt: null },
      user: { deletedAt: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    skip: offset,
    select: enrollmentSelect,
  });
}

export async function createEnrollment(payload: unknown) {
  const data = createEnrollmentSchema.parse(payload);

  const course = await prisma.course.findFirst({
    where: { id: data.courseId, deletedAt: null },
    select: { id: true },
  });

  if (!course) {
    throw createNotFoundError("Course", data.courseId);
  }

  const user = await prisma.user.findFirst({
    where: { id: data.userId, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    throw createNotFoundError("User", data.userId);
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      courseId_userId: {
        courseId: data.courseId,
        userId: data.userId,
      },
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (existing && !existing.deletedAt) {
    throw createHttpError(409, "Enrollment already exists");
  }

  return prisma.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId: data.courseId,
        userId: data.userId,
      },
    },
    update: {
      deletedAt: null,
      roleInCourse: data.roleInCourse,
    },
    create: {
      courseId: data.courseId,
      userId: data.userId,
      roleInCourse: data.roleInCourse,
    },
    select: enrollmentSelect,
  });
}

export async function deleteEnrollment(params: unknown) {
  const { enrollmentId } = enrollmentIdParamsSchema.parse(params);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, deletedAt: true },
  });

  if (!enrollment || enrollment.deletedAt) {
    throw createNotFoundError("Enrollment", enrollmentId);
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { deletedAt: new Date() },
  });
}
