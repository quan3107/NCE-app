/**
 * File: src/modules/courses/courses.shared.ts
 * Purpose: Provide shared helpers for course service modules.
 * Why: Avoids duplicating error handling and access control logic across course services.
 */
import type { CourseManager } from "./courses.types.js";
import { prisma } from "../../config/prismaClient.js";
import { UserRole } from "@prisma/client";

export type HttpError = Error & {
  statusCode?: number;
  expose?: boolean;
  details?: unknown;
};

export const createHttpError = (
  statusCode: number,
  message: string,
): HttpError => {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
};

export const canManageCourse = (
  ownerId: string,
  actor: CourseManager,
): boolean =>
  actor.role === UserRole.admin ||
  (actor.role === UserRole.teacher && actor.id === ownerId);

export async function ensureCourseAccessible(
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
