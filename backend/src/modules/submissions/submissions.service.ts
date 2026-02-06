/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: Implement submission workflows with Prisma-backed persistence.
 * Why: Keeps submission domain code organized and testable.
 */
import { Prisma } from "../../prisma/index.js";

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
import {
  isIeltsAssignmentType,
  parseSubmissionPayloadForType,
} from "../assignments/ielts.schema.js";
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
function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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
  let submittedAt = parseOptionalDate(payload.submittedAt, "submittedAt");
  let status =
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
    select: { id: true, type: true, assignmentConfig: true },
  });

  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const validatedPayload = parseSubmissionPayloadForType(
    assignment.type,
    payload.payload,
  );

  const isIeltsAssignment = isIeltsAssignmentType(assignment.type);
  const assignmentConfig = isIeltsAssignment
    ? asRecord(assignment.assignmentConfig)
    : undefined;
  const timingConfig = assignmentConfig
    ? asRecord(assignmentConfig.timing)
    : undefined;
  const attemptsConfig = assignmentConfig
    ? asRecord(assignmentConfig.attempts)
    : undefined;
  const enforceTiming = timingConfig?.enforce === true;
  const timingEnabled = timingConfig?.enabled !== false;
  const timingDurationMinutes = readNumber(
    timingConfig?.durationMinutes,
  );
  const timingStartAt = readString(timingConfig?.startAt);
  const timingEndAt = readString(timingConfig?.endAt);
  const timingAutoSubmit = timingConfig?.autoSubmit === true;
  const rejectLateStart =
    timingConfig?.rejectLateStart !== false;

  // Apply IELTS timing enforcement when explicitly enabled by the teacher.
  if (enforceTiming && timingEnabled) {
    const payloadRecord = asRecord(validatedPayload);
    const startedAtValue = readString(payloadRecord?.startedAt);
    if (!startedAtValue) {
      throw createHttpError(
        400,
        "payload.startedAt is required for timed submissions.",
      );
    }

    const startedAt = parseOptionalDate(
      startedAtValue,
      "payload.startedAt",
    );
    if (!startedAt) {
      throw createHttpError(
        400,
        "payload.startedAt is required for timed submissions.",
      );
    }

    const windowStart = parseOptionalDate(
      timingStartAt,
      "assignmentConfig.timing.startAt",
    );
    const windowEnd = parseOptionalDate(
      timingEndAt,
      "assignmentConfig.timing.endAt",
    );

    if (windowStart && startedAt < windowStart) {
      throw createHttpError(
        400,
        "Submission start time is before the allowed window.",
      );
    }
    if (windowEnd && startedAt > windowEnd && rejectLateStart) {
      throw createHttpError(
        400,
        "Submission start time is after the allowed window.",
      );
    }

    if (timingDurationMinutes) {
      const effectiveSubmittedAt =
        submittedAt ?? new Date();
      const elapsedMs =
        effectiveSubmittedAt.getTime() - startedAt.getTime();
      const limitMs = timingDurationMinutes * 60 * 1000;
      if (elapsedMs > limitMs) {
        if (timingAutoSubmit) {
          submittedAt = effectiveSubmittedAt;
          status = "submitted";
        } else {
          throw createHttpError(
            400,
            "Submission exceeded the time limit.",
          );
        }
      }
    }
  }

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
    const isSameAttempt = existing.status === "draft";
    const nextVersion = isSameAttempt
      ? existingVersion
      : existingVersion + 1;
    const maxAttempts = readNumber(attemptsConfig?.maxAttempts);
    if (maxAttempts !== undefined && nextVersion > maxAttempts) {
      throw createHttpError(
        409,
        "Maximum attempts reached for this assignment.",
      );
    }
    const payloadWithVersion: Prisma.InputJsonObject = {
      ...payloadJson,
      version: nextVersion,
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

  const payloadVersion =
    typeof payloadJson?.version === "number"
      ? payloadJson.version
      : 1;
  const maxAttempts = readNumber(attemptsConfig?.maxAttempts);
  if (maxAttempts !== undefined && payloadVersion > maxAttempts) {
    throw createHttpError(
      409,
      "Maximum attempts reached for this assignment.",
    );
  }
  const payloadWithVersion: Prisma.InputJsonObject = {
    ...payloadJson,
    version: payloadVersion,
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

/**
 * Get count of ungraded submissions for a teacher/admin.
 * Ungraded = submitted or late status, no grade exists.
 */
export async function getUngradedSubmissionsCount(teacherId: string): Promise<number> {
  const count = await prisma.submission.count({
    where: {
      deletedAt: null,
      status: { in: ["submitted", "late"] },
      grade: null,
      assignment: {
        course: {
          ownerId: teacherId,
          deletedAt: null,
        },
      },
    },
  });

  return count;
}
