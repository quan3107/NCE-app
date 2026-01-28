/**
 * File: src/modules/assignments/assignments.service.ts
 * Purpose: Implement assignment data access and validation via Prisma.
 * Why: Keeps assignment-specific operations encapsulated away from controllers.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import {
  assignmentIdParamsSchema,
  courseScopedParamsSchema,
  type CreateAssignmentPayload,
  type UpdateAssignmentPayload,
} from "./assignments.schema.js";
import { parseAssignmentConfigForType } from "./ielts.schema.js";

function parseOptionalDate(
  value: string | undefined,
  fieldName: string,
): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be an ISO date string.`);
  }
  return parsed;
}

export async function listAssignments(params: unknown) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  return prisma.assignment.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssignment(params: unknown) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
  });
  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }
  return assignment;
}

export async function createAssignment(
  params: unknown,
  payload: CreateAssignmentPayload,
) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  const dueAt = parseOptionalDate(payload.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(payload.publishedAt, "publishedAt");
  // Cast validated maps to Prisma JSON input, since Zod cannot enforce JsonValue types.
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined;
  const validatedAssignmentConfig = parseAssignmentConfigForType(
    payload.type,
    payload.assignmentConfig,
  );
  const assignmentConfig =
    validatedAssignmentConfig !== undefined
      ? (validatedAssignmentConfig as Prisma.InputJsonObject)
      : undefined;

  return prisma.assignment.create({
    data: {
      courseId,
      title: payload.title,
      description: payload.descriptionMd,
      type: payload.type,
      dueAt,
      latePolicy,
      assignmentConfig,
      publishedAt,
    },
  });
}

export async function updateAssignment(
  params: unknown,
  payload: UpdateAssignmentPayload,
) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);
  const { courseId } = courseScopedParamsSchema.parse(params);
  const dueAt = parseOptionalDate(payload.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(payload.publishedAt, "publishedAt");
  const latePolicy = payload.latePolicy
    ? (payload.latePolicy as Prisma.InputJsonObject)
    : undefined;

  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId, deletedAt: null },
  });
  if (!existing) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const targetType = payload.type ?? existing.type;
  const assignmentConfig =
    payload.assignmentConfig !== undefined
      ? (parseAssignmentConfigForType(
          targetType,
          payload.assignmentConfig,
        ) as Prisma.InputJsonObject)
      : undefined;

  const updateData: Prisma.AssignmentUpdateInput = {};
  if (payload.title !== undefined) {
    updateData.title = payload.title;
  }
  if (payload.descriptionMd !== undefined) {
    updateData.description = payload.descriptionMd;
  }
  if (payload.type !== undefined) {
    updateData.type = payload.type;
  }
  if (payload.dueAt !== undefined) {
    updateData.dueAt = dueAt;
  }
  if (payload.latePolicy !== undefined) {
    updateData.latePolicy = latePolicy;
  }
  if (payload.assignmentConfig !== undefined) {
    updateData.assignmentConfig = assignmentConfig;
  }
  if (payload.publishedAt !== undefined) {
    updateData.publishedAt = publishedAt;
  }

  return prisma.assignment.update({
    where: { id: assignmentId },
    data: updateData,
  });
}
