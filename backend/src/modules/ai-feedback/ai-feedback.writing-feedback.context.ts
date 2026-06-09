/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.context.ts
 * Purpose: Load and validate IELTS writing AI feedback request context.
 * Why: Keeps access, policy, prompt assembly, and input limits before draft creation.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import { prisma } from "../../prisma/client.js";
import { AssignmentType, EnrollmentRole, UserRole } from "../../prisma/index.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  parseAssignmentConfigForType,
  parseSubmissionPayloadForType,
} from "../assignments/ielts.schema.js";
import { writingFeedbackRequestParamsSchema } from "./ai-feedback.schema.js";
import {
  assertPromptInputWithinLimit,
  routeKeyForWritingFeedback,
  sha256,
  visibilityModeForPolicy,
} from "./ai-feedback.writing-feedback.support.js";
import { buildWritingPromptInput } from "./ai-feedback.writing-feedback.prompt-input.js";
import type {
  WritingAssignmentConfig,
  WritingFeedbackContext,
  WritingFeedbackRequestMode,
  WritingSubmission,
  WritingSubmissionPayload,
} from "./ai-feedback.writing-feedback.types.js";

const submittedStatuses = new Set(["submitted", "late", "graded"]);

function assertCanRequestWritingFeedback(
  submission: WritingSubmission,
  actor: RequestActor | undefined,
  mode: WritingFeedbackRequestMode,
): asserts actor is RequestActor {
  if (!actor) {
    throw createHttpError(
      401,
      "Authentication is required to request writing feedback.",
    );
  }

  if (actor.role === UserRole.admin) {
    return;
  }

  if (mode === "automatic" && actor.role === UserRole.student) {
    if (submission.studentId === actor.id) {
      return;
    }

    throw createHttpError(
      403,
      "You do not have permission to access this submission.",
    );
  }

  if (actor.role === UserRole.teacher) {
    const course = submission.assignment.course;
    const teachesCourse =
      course?.ownerId === actor.id ||
      course?.enrollments.some(
        (enrollment) =>
          enrollment.userId === actor.id &&
          enrollment.roleInCourse === EnrollmentRole.teacher &&
          enrollment.deletedAt === null,
      );

    if (teachesCourse) {
      return;
    }
  }

  throw createHttpError(
    403,
    "You do not have permission to access this submission.",
  );
}

function parseWritingAssignmentConfig(
  assignmentConfig: unknown,
): WritingAssignmentConfig {
  return parseAssignmentConfigForType(
    AssignmentType.writing,
    assignmentConfig,
  ) as WritingAssignmentConfig;
}

function parseWritingSubmissionPayload(payload: unknown): WritingSubmissionPayload {
  return parseSubmissionPayloadForType(
    AssignmentType.writing,
    payload,
  ) as WritingSubmissionPayload;
}

function assertWritingFeedbackPolicy(
  submission: WritingSubmission,
  assignmentConfig: WritingAssignmentConfig,
): void {
  if (submission.assignment.type !== AssignmentType.writing) {
    throw createHttpError(
      400,
      "AI writing feedback is only available for writing assignments.",
    );
  }

  if (!submittedStatuses.has(submission.status)) {
    throw createHttpError(
      409,
      "AI writing feedback requires a submitted writing response.",
    );
  }

  if (
    assignmentConfig.aiPolicy?.writingFeedbackMode !== "teacher_reviewed" &&
    assignmentConfig.aiPolicy?.writingFeedbackMode !== "instant_student_visible"
  ) {
    throw createHttpError(
      403,
      "AI writing feedback is not enabled for this assignment.",
    );
  }
}

export async function loadWritingFeedbackContext(
  params: unknown,
  actor: RequestActor | undefined,
  mode: WritingFeedbackRequestMode,
): Promise<WritingFeedbackContext> {
  const { submissionId } = writingFeedbackRequestParamsSchema.parse(params);
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      deletedAt: null,
      assignment: { deletedAt: null, course: { deletedAt: null } },
    },
    select: {
      id: true,
      assignmentId: true,
      studentId: true,
      status: true,
      payload: true,
      grade: {
        select: {
          id: true,
          rawScore: true,
          finalScore: true,
          band: true,
          feedback: true,
          deletedAt: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          type: true,
          assignmentConfig: true,
          courseId: true,
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
      },
    },
  });

  if (!submission) {
    throw createNotFoundError("Submission", submissionId);
  }

  assertCanRequestWritingFeedback(submission, actor, mode);

  const assignmentConfig = parseWritingAssignmentConfig(
    submission.assignment.assignmentConfig,
  );
  assertWritingFeedbackPolicy(submission, assignmentConfig);

  const submissionPayload = parseWritingSubmissionPayload(submission.payload);
  const promptInput = await buildWritingPromptInput({
    submission,
    assignmentConfig,
    submissionPayload,
    actor,
  });
  assertPromptInputWithinLimit(promptInput);
  const routeKey = routeKeyForWritingFeedback(assignmentConfig);

  return {
    actor,
    submission,
    assignmentConfig,
    submissionPayload,
    promptInput,
    routeKey,
    visibilityMode: visibilityModeForPolicy(assignmentConfig),
    inputHash: sha256(promptInput),
  };
}
