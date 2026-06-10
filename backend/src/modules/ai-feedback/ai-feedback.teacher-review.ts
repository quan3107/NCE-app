/**
 * File: src/modules/ai-feedback/ai-feedback.teacher-review.ts
 * Purpose: Publish, reject, and list teacher-reviewed AI writing feedback drafts.
 * Why: AI feedback remains draft material until an authorized teacher decides it.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import {
  AssignmentType,
  EnrollmentRole,
  Prisma,
  UserRole,
} from "../../prisma/index.js";
import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  validateIeltsCriterionBreakdown,
  type IeltsCriterionScore,
} from "../scoring/ieltsManualGrading.js";
import {
  aiWritingFeedbackApprovalBodySchema,
  aiWritingFeedbackRejectBodySchema,
  writingFeedbackDraftParamsSchema,
  writingFeedbackRequestParamsSchema,
  type WritingFeedbackHistoryResponse,
  type WritingFeedbackReviewResponse,
} from "./ai-feedback.schema.js";

type ReviewDraft = {
  id: string;
  submissionId: string;
  assignmentId: string;
  status: string;
  visibilityMode: "teacher_reviewed" | "instant_student_visible" | "hidden";
  generatedFeedback: unknown;
  teacherEditedFeedback: unknown;
  normalizedCriterionSuggestions: unknown;
  decision: string | null;
  decisionActorId: string | null;
  decidedAt: Date | null;
  finalizedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  gradeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DraftWithSubmission = ReviewDraft & {
  submission: {
    id: string;
    grade: {
      id: string;
      feedback: string | null;
      deletedAt: Date | null;
    } | null;
    assignment: {
      type: AssignmentType;
      course: {
        ownerId: string;
        enrollments: Array<{
          userId: string;
          roleInCourse: EnrollmentRole;
          deletedAt: Date | null;
        }>;
      } | null;
    };
  };
};

const decidableDraftStatuses = new Set([
  "accepted",
  "review_required",
  "failed",
]);

function jsonObjectOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function jsonArrayOrUndefined(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function toJsonArray(value: unknown[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toReviewResponse(draft: ReviewDraft): WritingFeedbackReviewResponse {
  const feedback =
    draft.teacherEditedFeedback ?? draft.generatedFeedback;

  return {
    id: draft.id,
    status: draft.status as WritingFeedbackReviewResponse["status"],
    visibilityMode: draft.visibilityMode,
    ...(jsonObjectOrUndefined(feedback)
      ? { feedback: jsonObjectOrUndefined(feedback) }
      : {}),
    ...(draft.failureCode ? { failureCode: draft.failureCode } : {}),
    ...(draft.failureMessage ? { failureMessage: draft.failureMessage } : {}),
    decision:
      draft.decision as WritingFeedbackReviewResponse["decision"] | undefined,
    gradeId: draft.gradeId,
    decidedAt: toIso(draft.decidedAt),
    finalizedAt: toIso(draft.finalizedAt),
    teacherEditedFeedback:
      jsonObjectOrUndefined(draft.teacherEditedFeedback) ?? null,
    normalizedCriterionSuggestions:
      jsonArrayOrUndefined(draft.normalizedCriterionSuggestions) ?? null,
  };
}

function courseWhereForTeacher(actor: RequestActor) {
  if (actor.role === UserRole.admin) {
    return {
      deletedAt: null,
    };
  }

  return {
    deletedAt: null,
    OR: [
      { ownerId: actor.id },
      {
        enrollments: {
          some: {
            userId: actor.id,
            roleInCourse: EnrollmentRole.teacher,
            deletedAt: null,
          },
        },
      },
    ],
  };
}

function assertTeacherReviewActor(
  actor: RequestActor | undefined,
): asserts actor is RequestActor {
  if (!actor) {
    throw createHttpError(
      401,
      "Authentication is required to review AI feedback.",
    );
  }

  if (actor.role !== UserRole.teacher && actor.role !== UserRole.admin) {
    throw createHttpError(
      403,
      "Only teachers and admins can review AI feedback.",
    );
  }
}

function assertCanReviewDraft(
  draft: DraftWithSubmission,
  actor: RequestActor,
): void {
  if (actor.role === UserRole.admin) {
    return;
  }

  const course = draft.submission.assignment.course;
  const teachesCourse =
    course?.ownerId === actor.id ||
    course?.enrollments.some(
      (enrollment) =>
        enrollment.userId === actor.id &&
        enrollment.roleInCourse === EnrollmentRole.teacher &&
        enrollment.deletedAt === null,
    );

  if (!teachesCourse) {
    throw createHttpError(
      403,
      "You do not have permission to review this AI feedback draft.",
    );
  }
}

function assertDraftCanBeDecided(draft: DraftWithSubmission): void {
  if (draft.decision || ["approved", "rejected", "finalized"].includes(draft.status)) {
    throw createHttpError(409, "AI feedback draft has already been decided.");
  }

  if (!decidableDraftStatuses.has(draft.status)) {
    throw createHttpError(
      409,
      "AI feedback draft is not ready for teacher review.",
    );
  }
}

function assertExistingGrade(draft: DraftWithSubmission) {
  const grade = draft.submission.grade;

  if (!grade || grade.deletedAt) {
    throw createHttpError(
      409,
      "AI feedback approval requires an existing grade.",
    );
  }

  return grade;
}

function validateCriterionSuggestions(
  draft: DraftWithSubmission,
  suggestions: IeltsCriterionScore[] | undefined,
): void {
  if (!suggestions) {
    return;
  }

  if (draft.submission.assignment.type !== AssignmentType.writing) {
    throw createHttpError(
      400,
      "AI feedback criterion suggestions are only supported for writing assignments.",
    );
  }

  try {
    validateIeltsCriterionBreakdown(AssignmentType.writing, suggestions);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid AI feedback criterion suggestions.";
    throw createHttpError(400, message);
  }
}

async function findDraftForDecision(
  submissionId: string,
  draftId: string,
): Promise<DraftWithSubmission> {
  const draft = await prisma.aiFeedbackDraft.findFirst({
    where: {
      id: draftId,
      submissionId,
      deletedAt: null,
      submission: {
        deletedAt: null,
        assignment: {
          deletedAt: null,
          course: {
            deletedAt: null,
          },
        },
      },
    },
    include: {
      submission: {
        select: {
          id: true,
          grade: {
            select: {
              id: true,
              feedback: true,
              deletedAt: true,
            },
          },
          assignment: {
            select: {
              type: true,
              course: {
                select: {
                  ownerId: true,
                  enrollments: {
                    select: {
                      userId: true,
                      roleInCourse: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!draft) {
    throw createNotFoundError("AI feedback draft", draftId);
  }

  return draft as DraftWithSubmission;
}

export async function listAiWritingFeedbackDrafts(
  params: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackHistoryResponse["drafts"]> {
  assertTeacherReviewActor(actor);
  const { submissionId } = writingFeedbackRequestParamsSchema.parse(params);
  const drafts = await prisma.aiFeedbackDraft.findMany({
    where: {
      submissionId,
      deletedAt: null,
      submission: {
        deletedAt: null,
        assignment: {
          type: AssignmentType.writing,
          deletedAt: null,
          course: courseWhereForTeacher(actor),
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return drafts.map((draft) => toReviewResponse(draft as ReviewDraft));
}

async function publishAiWritingFeedbackDraft(
  params: unknown,
  payload: unknown,
  actor: RequestActor | undefined,
  decision: "approved" | "finalized",
): Promise<WritingFeedbackReviewResponse> {
  assertTeacherReviewActor(actor);
  const { submissionId, draftId } = writingFeedbackDraftParamsSchema.parse(params);
  const data = aiWritingFeedbackApprovalBodySchema.parse(payload);
  const draft = await findDraftForDecision(submissionId, draftId);

  assertCanReviewDraft(draft, actor);
  assertDraftCanBeDecided(draft);
  if (
    decision === "finalized" &&
    draft.visibilityMode !== "instant_student_visible"
  ) {
    throw createHttpError(
      409,
      "Only instant-visible AI feedback drafts can be finalized through this endpoint.",
    );
  }
  const grade = assertExistingGrade(draft);
  validateCriterionSuggestions(
    draft,
    data.normalizedCriterionSuggestions as IeltsCriterionScore[] | undefined,
  );

  const decidedAt = new Date();
  const teacherEditedFeedback = toJsonObject({ feedbackMd: data.feedbackMd });
  const normalizedCriterionSuggestions = data.normalizedCriterionSuggestions
    ? toJsonArray(data.normalizedCriterionSuggestions)
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.grade.update({
      where: { id: grade.id },
      data: {
        feedback: data.feedbackMd,
        graderId: actor.id,
        gradedAt: decidedAt,
      },
    });

    return tx.aiFeedbackDraft.update({
      where: { id: draft.id },
      data: {
        status: decision,
        decision,
        decisionActorId: actor.id,
        gradeId: grade.id,
        teacherEditedFeedback,
        normalizedCriterionSuggestions,
        decidedAt,
        finalizedAt: decision === "finalized" ? decidedAt : undefined,
      },
    });
  });

  return toReviewResponse(updated as ReviewDraft);
}

export function approveAiWritingFeedbackDraft(
  params: unknown,
  payload: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackReviewResponse> {
  return publishAiWritingFeedbackDraft(params, payload, actor, "approved");
}

export function finalizeAiWritingFeedbackDraft(
  params: unknown,
  payload: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackReviewResponse> {
  return publishAiWritingFeedbackDraft(params, payload, actor, "finalized");
}

export async function rejectAiWritingFeedbackDraft(
  params: unknown,
  payload: unknown,
  actor?: RequestActor,
): Promise<WritingFeedbackReviewResponse> {
  assertTeacherReviewActor(actor);
  const { submissionId, draftId } = writingFeedbackDraftParamsSchema.parse(params);
  const data = aiWritingFeedbackRejectBodySchema.parse(payload);
  const draft = await findDraftForDecision(submissionId, draftId);

  assertCanReviewDraft(draft, actor);
  assertDraftCanBeDecided(draft);

  const decidedAt = new Date();
  const teacherEditedFeedback = data.reason
    ? toJsonObject({ rejectionReason: data.reason })
    : undefined;

  const updated = await prisma.aiFeedbackDraft.update({
    where: { id: draft.id },
    data: {
      status: "rejected",
      decision: "rejected",
      decisionActorId: actor.id,
      teacherEditedFeedback,
      decidedAt,
    },
  });

  return toReviewResponse(updated as ReviewDraft);
}
