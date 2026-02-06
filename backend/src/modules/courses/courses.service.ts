/**
 * File: src/modules/courses/courses.service.ts
 * Purpose: Implement course data workflows backed by Prisma.
 * Why: Encapsulates course-specific logic to keep controllers slim.
 */
import { Prisma } from "../../prisma/index.js";

import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  courseIdParamsSchema,
  createCourseSchema,
} from "./courses.schema.js";

export async function listCourses() {
  return prisma.course.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourseById(params: unknown) {
  const { courseId } = courseIdParamsSchema.parse(params);
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
  });
  if (!course) {
    throw createNotFoundError("Course", courseId);
  }
  return course;
}

export async function createCourse(payload: unknown) {
  // Map validation failures to 400s so bad payloads don't surface as 500s.
  const parseResult = createCourseSchema.safeParse(payload);

  if (!parseResult.success) {
    throw createHttpError(400, "Invalid course payload.", {
      issues: parseResult.error.flatten(),
    });
  }

  const data = parseResult.data;

  const owner = await prisma.user.findUnique({
    where: { id: data.ownerTeacherId },
    select: { id: true },
  });

  if (!owner) {
    throw createNotFoundError("Owner teacher", data.ownerTeacherId);
  }

  return prisma.course.create({
    data: {
      title: data.title,
      description: data.description,
      ownerId: data.ownerTeacherId,
      // Cast validated maps to Prisma JSON input for schedule metadata.
      scheduleJson: data.schedule
        ? (data.schedule as Prisma.InputJsonObject)
        : undefined,
    },
  });
}
