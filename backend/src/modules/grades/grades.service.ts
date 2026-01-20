/**
 * File: src/modules/grades/grades.service.ts
 * Purpose: Implement grading persistence and retrieval via Prisma.
 * Why: Keeps scoring routines decoupled from controllers.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { createNotFoundError } from "../../utils/httpError.js";
import {
  gradePayloadSchema,
  submissionScopedParamsSchema,
} from "./grades.schema.js";

export async function upsertGrade(
  params: unknown,
  payload: unknown,
) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const data = gradePayloadSchema.parse(payload);
  // Cast arrays to Prisma JSON inputs because Zod cannot enforce JsonValue types.
  const rubricBreakdown = data.rubricBreakdown
    ? (data.rubricBreakdown as Prisma.InputJsonArray)
    : undefined;
  const adjustments = data.adjustments
    ? (data.adjustments as Prisma.InputJsonArray)
    : undefined;

  return prisma.grade.upsert({
    where: { submissionId },
    create: {
      submissionId,
      graderId: data.graderId,
      rubricBreakdown,
      rawScore: data.rawScore,
      adjustments,
      finalScore: data.finalScore,
      feedback: data.feedbackMd,
    },
    update: {
      graderId: data.graderId,
      rubricBreakdown,
      rawScore: data.rawScore,
      adjustments,
      finalScore: data.finalScore,
      feedback: data.feedbackMd,
    },
  });
}

export async function getGrade(params: unknown) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const grade = await prisma.grade.findFirst({
    where: { submissionId, deletedAt: null },
  });
  if (!grade) {
    throw createNotFoundError("Grade", submissionId);
  }
  return grade;
}
