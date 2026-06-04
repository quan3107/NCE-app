/**
 * File: src/modules/ai-feedback/ai-feedback.repository.ts
 * Purpose: Persist AI feedback drafts and objective explanations.
 * Why: Keeps AI-generated data separate from final teacher-approved grade feedback.
 */
import { z } from "zod";

import { prisma } from "../../prisma/client.js";
import { Prisma, type AiFeedbackDraftStatus } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  aiFeedbackDraftDecisionInputSchema,
  createAiFeedbackDraftSchema,
  studentVisibleAiFeedbackDraftParamsSchema,
  supersedeAiFeedbackDraftsSchema,
  upsertAiObjectiveExplanationSchema,
} from "./ai-feedback.schema.js";
import {
  assertSubmissionAssignmentMatches,
  getActiveSubmissionAssignment,
  isUniqueConstraintError,
} from "./ai-feedback.repository.integrity.js";

const activeGenerationStatuses = ["queued", "running"] as const;
const studentVisibleDraftStatuses = [
  "accepted",
  "approved",
  "finalized",
] as const;
const supersedableDraftStatuses = [
  "queued",
  "running",
  "accepted",
  "review_required",
  "approved",
] as const;

const instantVisibleAssignmentConfigSchema = z
  .object({
    aiPolicy: z
      .object({
        writingFeedbackMode: z.literal("instant_student_visible"),
      })
      .passthrough(),
  })
  .passthrough();

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function toJsonArray(value: unknown[]): Prisma.InputJsonArray {
  return value as Prisma.InputJsonArray;
}

function statusForDecision(decision: string): AiFeedbackDraftStatus {
  switch (decision) {
    case "accepted":
      return "accepted";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "finalized":
      return "finalized";
    default:
      throw createHttpError(400, "Unsupported AI feedback draft decision.");
  }
}

function isInstantVisibleAssignmentPolicy(assignmentConfig: unknown): boolean {
  return instantVisibleAssignmentConfigSchema.safeParse(assignmentConfig).success;
}

async function findActiveAiFeedbackDraft(submissionId: string) {
  return prisma.aiFeedbackDraft.findFirst({
    where: {
      submissionId,
      deletedAt: null,
      status: {
        in: [...activeGenerationStatuses],
      },
    },
    select: {
      id: true,
    },
  });
}

function createActiveDraftConflict(draftId: string) {
  return createHttpError(
    409,
    "An AI feedback draft is already queued or running for this submission.",
    { draftId },
  );
}

export async function createAiFeedbackDraft(input: unknown) {
  const data = createAiFeedbackDraftSchema.parse(input);
  const submission = await getActiveSubmissionAssignment(data.submissionId);
  assertSubmissionAssignmentMatches(submission, data.assignmentId);

  const activeDraft = await findActiveAiFeedbackDraft(data.submissionId);

  if (activeDraft) {
    throw createActiveDraftConflict(activeDraft.id);
  }

  try {
    return await prisma.aiFeedbackDraft.create({
      data: {
        submissionId: data.submissionId,
        assignmentId: submission.assignmentId,
        requesterId: data.requesterId,
        gradeId: data.gradeId,
        promptVersion: data.promptVersion,
        routeKey: data.routeKey,
        provider: data.provider,
        model: data.model,
        reasoningEffort: data.reasoningEffort,
        inputHash: data.inputHash,
        status: data.status,
        visibilityMode: data.visibilityMode,
        generatedFeedback: toJsonObject(data.generatedFeedback),
        teacherEditedFeedback: data.teacherEditedFeedback
          ? toJsonObject(data.teacherEditedFeedback)
          : undefined,
        normalizedCriterionSuggestions: data.normalizedCriterionSuggestions
          ? toJsonArray(data.normalizedCriterionSuggestions)
          : undefined,
        criteriaVersion: data.criteriaVersion,
        safetyFlags: data.safetyFlags ? toJsonObject(data.safetyFlags) : undefined,
        failureCode: data.failureCode,
        failureMessage: data.failureMessage,
        retryCount: data.retryCount,
        nextRetryAt: data.nextRetryAt,
        lastAttemptAt: data.lastAttemptAt,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentDraft = await findActiveAiFeedbackDraft(data.submissionId);
    if (!concurrentDraft) {
      throw error;
    }

    throw createActiveDraftConflict(concurrentDraft.id);
  }
}

export async function getStudentVisibleAiFeedbackDraft(input: unknown) {
  const { submissionId, studentId } =
    studentVisibleAiFeedbackDraftParamsSchema.parse(input);
  const draft = await prisma.aiFeedbackDraft.findFirst({
    where: {
      submissionId,
      deletedAt: null,
      visibilityMode: "instant_student_visible",
      status: {
        in: [...studentVisibleDraftStatuses],
      },
      submission: {
        studentId,
        deletedAt: null,
        assignment: {
          deletedAt: null,
        },
      },
    },
    include: {
      submission: {
        select: {
          assignment: {
            select: {
              assignmentConfig: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!draft) {
    return null;
  }

  return isInstantVisibleAssignmentPolicy(
    draft.submission.assignment.assignmentConfig,
  )
    ? draft
    : null;
}

export async function recordAiFeedbackDraftDecision(input: unknown) {
  const data = aiFeedbackDraftDecisionInputSchema.parse(input);
  const decidedAt = new Date();

  return prisma.aiFeedbackDraft.update({
    where: {
      id: data.draftId,
    },
    data: {
      decision: data.decision,
      decisionActorId: data.actorId,
      gradeId: data.gradeId,
      teacherEditedFeedback: data.teacherEditedFeedback
        ? toJsonObject(data.teacherEditedFeedback)
        : undefined,
      status: statusForDecision(data.decision),
      decidedAt,
      finalizedAt: data.decision === "finalized" ? decidedAt : undefined,
    },
  });
}

export async function supersedeAiFeedbackDrafts(input: unknown) {
  const data = supersedeAiFeedbackDraftsSchema.parse(input);

  return prisma.aiFeedbackDraft.updateMany({
    where: {
      submissionId: data.submissionId,
      id: data.exceptDraftId
        ? {
            not: data.exceptDraftId,
          }
        : undefined,
      deletedAt: null,
      status: {
        in: [...supersedableDraftStatuses],
      },
    },
    data: {
      status: "superseded",
    },
  });
}

export async function upsertAiObjectiveExplanation(input: unknown) {
  const data = upsertAiObjectiveExplanationSchema.parse(input);
  const submission = await getActiveSubmissionAssignment(data.submissionId);
  assertSubmissionAssignmentMatches(submission, data.assignmentId);

  const cacheWhere = {
    submissionId: data.submissionId,
    assignmentId: submission.assignmentId,
    questionId: data.questionId,
    deterministicResult: data.deterministicResult,
    promptVersion: data.promptVersion,
    sourceContextHash: data.sourceContextHash,
    routeKey: data.routeKey,
    requesterId: data.requesterId,
    deletedAt: null,
  };
  const existingExplanation = await prisma.aiObjectiveExplanation.findFirst({
    where: cacheWhere,
  });

  if (existingExplanation) {
    return existingExplanation;
  }

  try {
    return await prisma.aiObjectiveExplanation.create({
      data: {
        submissionId: data.submissionId,
        assignmentId: submission.assignmentId,
        requesterId: data.requesterId,
        questionId: data.questionId,
        deterministicResult: data.deterministicResult,
        promptVersion: data.promptVersion,
        sourceContextHash: data.sourceContextHash,
        routeKey: data.routeKey,
        provider: data.provider,
        model: data.model,
        status: data.status,
        generatedExplanation: data.generatedExplanation
          ? toJsonObject(data.generatedExplanation)
          : undefined,
        failureCode: data.failureCode,
        failureMessage: data.failureMessage,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentExplanation = await prisma.aiObjectiveExplanation.findFirst({
      where: cacheWhere,
    });

    if (!concurrentExplanation) {
      throw error;
    }

    return concurrentExplanation;
  }
}
