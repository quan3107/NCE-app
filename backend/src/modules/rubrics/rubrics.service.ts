/**
 * File: src/modules/rubrics/rubrics.service.ts
 * Purpose: Provide rubric persistence and lookup logic via Prisma.
 * Why: Encapsulates rubric workflows so controllers stay focused on HTTP.
 */
import {
  EnrollmentRole,
  Prisma,
  UserRole,
} from "../../prisma/generated/client/client.js";

import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  courseScopedParamsSchema,
  createRubricSchema,
} from "./rubrics.schema.js";

type Actor = {
  id: string;
  role: UserRole;
};

async function ensureCourseRubricAccess(courseId: string, actor: Actor): Promise<void> {
  if (actor.role === UserRole.admin) {
    return;
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: {
      ownerId: true,
      enrollments: {
        where: {
          userId: actor.id,
          roleInCourse: EnrollmentRole.teacher,
          deletedAt: null,
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (actor.role !== UserRole.teacher) {
    throw createHttpError(403, "You do not have permission to access this course");
  }

  const canManage = course.ownerId === actor.id || course.enrollments.length > 0;
  if (!canManage) {
    throw createHttpError(403, "You do not have permission to access this course");
  }
}

export async function listRubrics(params: unknown, actor: Actor) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  await ensureCourseRubricAccess(courseId, actor);

  return prisma.rubric.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRubric(
  params: unknown,
  payload: unknown,
  actor: Actor,
) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  await ensureCourseRubricAccess(courseId, actor);

  const data = createRubricSchema.parse(payload);
  // Cast validated criteria to Prisma JSON input for the rubric schema.
  const criteria = data.criteria as Prisma.InputJsonArray;

  return prisma.rubric.create({
    data: {
      courseId,
      name: data.name,
      criteria,
    },
  });
}
