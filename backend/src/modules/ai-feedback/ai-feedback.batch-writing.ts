/**
 * File: src/modules/ai-feedback/ai-feedback.batch-writing.ts
 * Purpose: Queue assignment-scoped batches of AI writing feedback drafts.
 * Why: Teachers need recoverable per-submission results without bypassing existing visibility and access checks.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import {
  EnrollmentRole,
  SubmissionStatus,
  UserRole,
} from "../../prisma/index.js";
import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import { findActiveAiFeedbackDraftSubmissionIds } from "./ai-feedback.repository.js";
import {
  aiWritingFeedbackBatchRequestSchema,
  assignmentWritingFeedbackBatchParamsSchema,
  type AiWritingFeedbackBatchResponse,
  type WritingFeedbackResponse,
} from "./ai-feedback.schema.js";
import { requestAiWritingFeedback } from "./ai-feedback.writing-feedback.js";

const submittedFilterStatuses = [
  SubmissionStatus.submitted,
  SubmissionStatus.late,
  SubmissionStatus.graded,
] as const;
const ungradedFilterStatuses = [
  SubmissionStatus.submitted,
  SubmissionStatus.late,
] as const;
const maxBatchSubmissionCount = 100;
const writingFeedbackDisabledMessage =
  "AI writing feedback is not enabled for this assignment.";

type BatchCandidate = {
  id: string;
};

type BatchResult = AiWritingFeedbackBatchResponse["results"][number];

function assertCanAccessBatchAssignment(
  assignment: {
    id: string;
    course: {
      ownerId: string;
      enrollments: Array<{
        userId: string;
        roleInCourse: EnrollmentRole;
        deletedAt: Date | null;
      }>;
    } | null;
  },
  actor: RequestActor | undefined,
): asserts actor is RequestActor {
  if (!actor) {
    throw createHttpError(
      401,
      "Authentication is required to request AI writing feedback.",
    );
  }

  if (actor.role === UserRole.admin) {
    return;
  }

  if (actor.role !== UserRole.teacher) {
    throw createHttpError(
      403,
      "You do not have permission to request AI writing feedback for this assignment.",
    );
  }

  const teachesCourse =
    assignment.course?.ownerId === actor.id ||
    assignment.course?.enrollments.some(
      (enrollment) =>
        enrollment.userId === actor.id &&
        enrollment.roleInCourse === EnrollmentRole.teacher &&
        enrollment.deletedAt === null,
    );

  if (!teachesCourse) {
    throw createHttpError(
      403,
      "You do not have permission to request AI writing feedback for this assignment.",
    );
  }
}

async function loadBatchAssignment(
  courseId: string,
  assignmentId: string,
  actor: RequestActor | undefined,
) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      courseId,
      deletedAt: null,
      course: { deletedAt: null },
    },
    select: {
      id: true,
      course: {
        select: {
          ownerId: true,
          enrollments: {
            where: actor
              ? {
                  userId: actor.id,
                  roleInCourse: EnrollmentRole.teacher,
                  deletedAt: null,
                }
              : undefined,
            select: {
              userId: true,
              roleInCourse: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw createNotFoundError("Assignment", assignmentId);
  }

  assertCanAccessBatchAssignment(assignment, actor);

  return assignment;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

async function listBatchCandidatesByIds(
  assignmentId: string,
  submissionIds: string[],
): Promise<BatchCandidate[]> {
  const candidates = await prisma.submission.findMany({
    where: {
      assignmentId,
      id: {
        in: submissionIds,
      },
      deletedAt: null,
      assignment: { deletedAt: null, course: { deletedAt: null } },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return submissionIds.flatMap((submissionId) => {
    const candidate = byId.get(submissionId);
    return candidate ? [candidate] : [];
  });
}

async function listBatchCandidatesByFilter(
  assignmentId: string,
  filter: "submitted" | "ungraded",
): Promise<BatchCandidate[]> {
  return prisma.submission.findMany({
    where: {
      assignmentId,
      deletedAt: null,
      status: {
        in:
          filter === "ungraded"
            ? [...ungradedFilterStatuses]
            : [...submittedFilterStatuses],
      },
      ...(filter === "ungraded"
        ? {
            OR: [{ grade: null }, { grade: { deletedAt: { not: null } } }],
          }
        : {}),
      assignment: { deletedAt: null, course: { deletedAt: null } },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: maxBatchSubmissionCount,
  });
}

function isHttpStatus(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode: unknown }).statusCode === statusCode
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "AI writing feedback could not be queued.";
}

function isWritingFeedbackPolicyDisabled(error: unknown): boolean {
  return isHttpStatus(error, 403) && errorMessage(error) === writingFeedbackDisabledMessage;
}

function statusForDraft(draft: WritingFeedbackResponse): BatchResult["status"] {
  return draft.status === "review_required" ? "review_required" : "queued";
}

async function queueBatchSubmission(
  submissionId: string,
  actor: RequestActor,
): Promise<BatchResult> {
  try {
    const draft = await requestAiWritingFeedback({ submissionId }, actor);

    return {
      submissionId,
      status: statusForDraft(draft),
      draft,
    };
  } catch (error) {
    if (isWritingFeedbackPolicyDisabled(error)) {
      return {
        submissionId,
        status: "policy_disabled",
        reason: writingFeedbackDisabledMessage,
      };
    }

    if (isHttpStatus(error, 403) || isHttpStatus(error, 404)) {
      return {
        submissionId,
        status: "unauthorized",
        reason: "Submission is not available for this assignment.",
      };
    }

    if (isHttpStatus(error, 409)) {
      return {
        submissionId,
        status: "skipped",
        reason: errorMessage(error),
      };
    }

    return {
      submissionId,
      status: "failed_to_queue",
      reason: errorMessage(error),
    };
  }
}

export async function requestAssignmentWritingFeedbackBatch(
  params: unknown,
  payload: unknown,
  actor?: RequestActor,
): Promise<AiWritingFeedbackBatchResponse> {
  const { courseId, assignmentId } =
    assignmentWritingFeedbackBatchParamsSchema.parse(params);
  const request = aiWritingFeedbackBatchRequestSchema.parse(payload ?? {});
  await loadBatchAssignment(courseId, assignmentId, actor);
  if (!actor) {
    throw createHttpError(
      401,
      "Authentication is required to request AI writing feedback.",
    );
  }

  const requestedSubmissionIds = request.submissionIds
    ? uniqueIds(request.submissionIds)
    : undefined;
  const candidates = requestedSubmissionIds
    ? await listBatchCandidatesByIds(assignmentId, requestedSubmissionIds)
    : await listBatchCandidatesByFilter(assignmentId, request.filter ?? "submitted");
  const candidateIds = candidates.map((candidate) => candidate.id);
  const activeDraftSubmissionIds =
    await findActiveAiFeedbackDraftSubmissionIds(candidateIds);
  const results: BatchResult[] = [];

  if (requestedSubmissionIds) {
    const candidateById = new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    );
    for (const submissionId of requestedSubmissionIds) {
      if (!candidateById.has(submissionId)) {
        results.push({
          submissionId,
          status: "unauthorized",
          reason: "Submission is not available for this assignment.",
        });
        continue;
      }

      if (activeDraftSubmissionIds.has(submissionId)) {
        results.push({
          submissionId,
          status: "skipped",
          reason: "AI writing feedback is already queued or running.",
        });
        continue;
      }

      results.push(await queueBatchSubmission(submissionId, actor));
    }

    return {
      assignmentId,
      requestedCount: requestedSubmissionIds.length,
      results,
    };
  }

  for (const submissionId of candidateIds) {
    if (activeDraftSubmissionIds.has(submissionId)) {
      results.push({
        submissionId,
        status: "skipped",
        reason: "AI writing feedback is already queued or running.",
      });
      continue;
    }

    results.push(await queueBatchSubmission(submissionId, actor));
  }

  return {
    assignmentId,
    requestedCount: candidateIds.length,
    results,
  };
}
