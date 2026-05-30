/**
 * File: src/modules/submissions/submissions.service.ts
 * Purpose: Implement submission workflows with Prisma-backed persistence.
 * Why: Keeps submission domain code organized and testable.
 */
import { Prisma } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
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
import { enqueueTeacherSubmissionNotifications } from "./submissions.notifications.js";
import {
  applyIeltsTimingRules,
  parseSubmittedAt,
  readMaxAttempts,
} from "./submissions.timing.js";
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
  let submittedAt = parseSubmittedAt(payload.submittedAt);
  let status =
    payload.status ?? (submittedAt ? "submitted" : "draft");
  if (!user || user.role !== "student") {
    throw createHttpError(403, "Only students can submit assignments.");
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: {
      id: true,
      courseId: true,
      title: true,
      type: true,
      assignmentConfig: true,
      course: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  const validatedPayload = parseSubmissionPayloadForType(
    assignment.type,
    payload.payload,
  );

  const isIeltsAssignment = isIeltsAssignmentType(assignment.type);
  ({ status, submittedAt } = applyIeltsTimingRules({
    assignmentConfig: assignment.assignmentConfig,
    isIeltsAssignment,
    status,
    submittedAt,
    validatedPayload,
  }));

  // Cast validated payloads to Prisma JSON input for storage.
  const payloadJson = validatedPayload as Prisma.InputJsonObject;

  const existing = await prisma.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: user.id,
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
    const maxAttempts = readMaxAttempts(
      assignment.assignmentConfig,
      isIeltsAssignment,
    );
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
    if (status === "submitted" || status === "late") {
      try {
        await enqueueTeacherSubmissionNotifications({
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          courseId: assignment.courseId,
          courseTitle: assignment.course?.title ?? "",
          studentId: user.id,
          submissionId: updatedSubmission.id,
          status,
          submittedAt: updatedSubmission.submittedAt,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            event: "teacher_submission_notification_enqueue_failed",
            assignment_id: assignment.id,
            submission_id: updatedSubmission.id,
          },
          "Failed to enqueue teacher submission notifications",
        );
      }
    }
    return updatedSubmission;
  }

  const payloadVersion =
    typeof payloadJson?.version === "number"
      ? payloadJson.version
      : 1;
  const maxAttempts = readMaxAttempts(
    assignment.assignmentConfig,
    isIeltsAssignment,
  );
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
      studentId: user.id,
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
  if (status === "submitted" || status === "late") {
    try {
      await enqueueTeacherSubmissionNotifications({
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title ?? "",
        studentId: user.id,
        submissionId: createdSubmission.id,
        status,
        submittedAt: createdSubmission.submittedAt,
      });
    } catch (error) {
      logger.error(
        {
          err: error,
          event: "teacher_submission_notification_enqueue_failed",
          assignment_id: assignment.id,
          submission_id: createdSubmission.id,
        },
        "Failed to enqueue teacher submission notifications",
      );
    }
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
