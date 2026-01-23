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

export async function listSubmissions(
  params: unknown,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  const isStudent = user?.role === "student";
  return prisma.submission.findMany({
    where: {
      assignmentId,
      deletedAt: null,
      ...(isStudent ? { studentId: user?.id } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSubmission(
  params: unknown,
  payload: unknown,
  user?: { id: string; role: string },
) {
  const { assignmentId } = assignmentScopedParamsSchema.parse(params);
  const data = createSubmissionSchema.parse(payload);
  const submittedAt = parseOptionalDate(data.submittedAt, "submittedAt");
  const status =
    data.status ?? (submittedAt ? "submitted" : "draft");
  if (!user || user.role !== "student") {
    throw createHttpError(403, "Only students can submit assignments.");
  }

  if (data.studentId !== user.id) {
    throw createHttpError(
      403,
      "Student ID must match the authenticated user.",
    );
  }

  // Accept explicit studentId while preserving auth verification.
  // Cast validated payloads to Prisma JSON input for storage.
  const payloadJson = data.payload as Prisma.InputJsonObject;

  const existing = await prisma.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: data.studentId,
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

    return prisma.submission.update({
      where: { id: existing.id },
      data: {
        status,
        submittedAt,
        payload: payloadWithVersion,
      },
    });
  }

  const payloadWithVersion: Prisma.InputJsonObject = {
    ...payloadJson,
    version:
      typeof payloadJson?.version === "number" ? payloadJson.version : 1,
  };

  return prisma.submission.create({
    data: {
      assignmentId,
      studentId: data.studentId,
      status,
      submittedAt,
      payload: payloadWithVersion,
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
