/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: Implement submission workflows with Prisma-backed persistence.
 * Why: Keeps submission domain code organized and testable.
 */
import { Prisma } from "../../prisma/generated/client/client.js";

import { prisma } from "../../prisma/client.js";
import {
  createHttpError,
  createNotFoundError,
} from "../../utils/httpError.js";
import {
  assignmentScopedParamsSchema,
  DEFAULT_SUBMISSION_LIMIT,
  submissionIdParamsSchema,
  submissionQuerySchema,
  type CreateSubmissionPayload,
} from "./submissions.schema.js";
import { parseSubmissionPayloadForType } from "../assignments/ielts.schema.js";
import { autoScoreSubmission } from "../scoring/ieltsScoring.service.js";

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

export async function listSubmissions(
  params: unknown,
  query: unknown,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  const { limit: rawLimit, offset: rawOffset } =
    submissionQuerySchema.parse(query);
  const limit = rawLimit ?? DEFAULT_SUBMISSION_LIMIT;
  const offset = rawOffset ?? 0;
  const isStudent = user?.role === "student";
  return prisma.submission.findMany({
    where: {
      assignmentId,
      deletedAt: null,
      ...(isStudent ? { studentId: user?.id } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    skip: offset,
  });
}

export async function createSubmission(
  params: unknown,
  payload: CreateSubmissionPayload,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  const submittedAt = parseOptionalDate(payload.submittedAt, "submittedAt");
  const status =
    payload.status ?? (submittedAt ? "submitted" : "draft");
  if (!user || user.role !== "student") {
    throw createHttpError(403, "Only students can submit assignments.");
  }

  if (payload.studentId !== user.id) {
    throw createHttpError(
      403,
      "Student ID must match the authenticated user.",
    );
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: { id: true, type: true },
  });

  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const validatedPayload = parseSubmissionPayloadForType(
    assignment.type,
    payload.payload,
  );

  // Accept explicit studentId while preserving auth verification.
  // Cast validated payloads to Prisma JSON input for storage.
  const payloadJson = validatedPayload as Prisma.InputJsonObject;

  const existing = await prisma.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: payload.studentId,
      },
    },
  });

  if (existing) {
    if (existing.status === "graded") {
      throw createHttpError(
        409,
        "This submission has already been graded and cannot be resubmitted.",
      );
    }

    const existingPayload = existing.payload as Prisma.InputJsonObject;
    const existingVersion =
      typeof existingPayload?.version === "number"
        ? existingPayload.version
        : 1;
    const payloadWithVersion: Prisma.InputJsonObject = {
      ...payloadJson,
      version: existingVersion + 1,
    };

    const updatedSubmission = await prisma.submission.update({
      where: { id: existing.id },
      data: {
        status,
        submittedAt,
        payload: payloadWithVersion,
      },
    });
    if (
      (status === "submitted" || status === "late") &&
      (assignment.type === "reading" || assignment.type === "listening")
    ) {
      await autoScoreSubmission(updatedSubmission.id);
    }
    return updatedSubmission;
  }

  const payloadWithVersion: Prisma.InputJsonObject = {
    ...payloadJson,
    version:
      typeof payloadJson?.version === "number" ? payloadJson.version : 1,
  };

  const createdSubmission = await prisma.submission.create({
    data: {
      assignmentId,
      studentId: payload.studentId,
      status,
      submittedAt,
      payload: payloadWithVersion,
    },
  });
  if (
    (status === "submitted" || status === "late") &&
    (assignment.type === "reading" || assignment.type === "listening")
  ) {
    await autoScoreSubmission(createdSubmission.id);
  }
  return createdSubmission;
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
