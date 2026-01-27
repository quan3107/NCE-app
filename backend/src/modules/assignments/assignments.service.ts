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
  createAssignmentSchema,
  updateAssignmentSchema,
} from "./assignments.schema.js";

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
  payload: unknown,
) {
  const { courseId } = courseScopedParamsSchema.parse(params);
  const data = createAssignmentSchema.parse(payload);
  const dueAt = parseOptionalDate(data.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(data.publishedAt, "publishedAt");
  // Cast validated maps to Prisma JSON input, since Zod cannot enforce JsonValue types.
  const latePolicy = data.latePolicy
    ? (data.latePolicy as Prisma.InputJsonObject)
    : undefined;
  const assignmentConfig = data.assignmentConfig
    ? (data.assignmentConfig as Prisma.InputJsonObject)
    : undefined;

  return prisma.assignment.create({
    data: {
      courseId,
      title: data.title,
      description: data.descriptionMd,
      type: data.type,
      dueAt,
      latePolicy,
      assignmentConfig,
      publishedAt,
    },
  });
}

export async function updateAssignment(
  params: unknown,
  payload: unknown,
) {
  const { assignmentId } = assignmentIdParamsSchema.parse(params);
  const { courseId } = courseScopedParamsSchema.parse(params);
  const data = updateAssignmentSchema.parse(payload);
  const dueAt = parseOptionalDate(data.dueAt, "dueAt");
  const publishedAt = parseOptionalDate(data.publishedAt, "publishedAt");
  const latePolicy = data.latePolicy
    ? (data.latePolicy as Prisma.InputJsonObject)
    : undefined;
  const assignmentConfig = data.assignmentConfig
    ? (data.assignmentConfig as Prisma.InputJsonObject)
    : undefined;

  const existing = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId, deletedAt: null },
  });
  if (!existing) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const updateData: Prisma.AssignmentUpdateInput = {};
  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.descriptionMd !== undefined) {
    updateData.description = data.descriptionMd;
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }
  if (data.dueAt !== undefined) {
    updateData.dueAt = dueAt;
  }
  if (data.latePolicy !== undefined) {
    updateData.latePolicy = latePolicy;
  }
  if (data.assignmentConfig !== undefined) {
    updateData.assignmentConfig = assignmentConfig;
  }
  if (data.publishedAt !== undefined) {
    updateData.publishedAt = publishedAt;
  }

  return prisma.assignment.update({
    where: { id: assignmentId },
    data: updateData,
  });
}
