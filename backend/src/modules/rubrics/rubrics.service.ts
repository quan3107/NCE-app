/**
 * File: src/modules/rubrics/rubrics.service.ts
 * Purpose: Provide rubric persistence and lookup logic via Prisma.
 * Why: Encapsulates rubric workflows so controllers stay focused on HTTP.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  courseScopedParamsSchema,
  createRubricSchema,
} from "./rubrics.schema.js";

export async function listRubrics(params: unknown) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  return prisma.rubric.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRubric(
  params: unknown,
  payload: unknown,
) {
  const { courseId } = courseScopedParamsSchema.parse(params);
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
