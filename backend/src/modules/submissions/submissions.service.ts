/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: Implement submission workflows with Prisma-backed persistence.
 * Why: Keeps submission domain code organized and testable.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import {
  assignmentScopedParamsSchema,
  createSubmissionSchema,
  submissionIdParamsSchema,
} from "./submissions.schema.js";

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

export async function listSubmissions(params: unknown) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  return prisma.submission.findMany({
    where: { assignmentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSubmission(
  params: unknown,
  payload: unknown,
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  const data = createSubmissionSchema.parse(payload);
  const submittedAt = parseOptionalDate(data.submittedAt, "submittedAt");
  const status =
    data.status ?? (submittedAt ? "submitted" : "draft");
  // Accept explicit studentId until auth context exists to infer the actor.
  // Cast validated payloads to Prisma JSON input for storage.
  const payloadJson = data.payload as Prisma.InputJsonObject;

  return prisma.submission.create({
    data: {
      assignmentId,
      studentId: data.studentId,
      status,
      submittedAt,
      payload: payloadJson,
    },
  });
}

export async function getSubmissionById(
  params: unknown,
) {
  const { submissionId } = submissionIdParamsSchema.parse(params);
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
  });
  if (!submission) {
    throw createNotFoundError("Submission", submissionId);
  }
  return submission;
}
