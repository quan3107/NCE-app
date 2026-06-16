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
const missingWritingPayloadMessage =
  "Writing submission payload is missing Task 1 and Task 2 text.";

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
  const currentPayload = safeParseWritingSubmissionPayload(payload);
  const normalizedPayload =
    currentPayload ?? normalizeLegacyWritingSubmissionPayload(payload);

  if (
    !normalizedPayload ||
    !hasRequiredWritingTaskText(normalizedPayload)
  ) {
    throw createHttpError(400, missingWritingPayloadMessage);
  }

  return parseSubmissionPayloadForType(
    AssignmentType.writing,
    normalizedPayload,
  ) as WritingSubmissionPayload;
}

function safeParseWritingSubmissionPayload(
  payload: unknown,
): WritingSubmissionPayload | null {
  try {
    return parseSubmissionPayloadForType(
      AssignmentType.writing,
      payload,
    ) as WritingSubmissionPayload;
  } catch {
    return null;
  }
}

function hasRequiredWritingTaskText(payload: WritingSubmissionPayload): boolean {
  return (
    typeof payload.task1?.text === "string" &&
    payload.task1.text.trim() !== "" &&
    typeof payload.task2?.text === "string" &&
    payload.task2.text.trim() !== ""
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTextFromRecord(value: unknown): string {
  if (!isRecord(value)) {
    return readTrimmedString(value);
  }

  for (const key of ["text", "response", "answer", "value", "content"]) {
    const text = readTrimmedString(value[key]);
    if (text) {
      return text;
    }
  }

  return "";
}

function taskKeyMatches(value: unknown, task: "task1" | "task2"): boolean {
  const normalized = readTrimmedString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === task || normalized === `writing${task}`;
}

function readTaskTextFromAnswers(
  answers: unknown,
  task: "task1" | "task2",
): string {
  if (!Array.isArray(answers)) {
    return "";
  }

  for (const answer of answers) {
    if (!isRecord(answer)) {
      continue;
    }

    const matchesTask = ["questionId", "taskId", "id", "key", "name"].some((key) =>
      taskKeyMatches(answer[key], task),
    );
    if (!matchesTask) {
      continue;
    }

    const text = readTextFromRecord(answer);
    if (text) {
      return text;
    }
  }

  return "";
}

function readTaskText(
  payload: Record<string, unknown>,
  task: "task1" | "task2",
): string {
  const currentTaskText = readTextFromRecord(payload[task]);
  if (currentTaskText) {
    return currentTaskText;
  }

  const directKeys =
    task === "task1"
      ? ["task1Text", "task1_text", "task1Response", "task1_response"]
      : ["task2Text", "task2_text", "task2Response", "task2_response"];

  for (const key of directKeys) {
    const text = readTrimmedString(payload[key]);
    if (text) {
      return text;
    }
  }

  for (const containerKey of ["responses", "answersByTask", "tasks"]) {
    const container = payload[containerKey];
    if (!isRecord(container)) {
      continue;
    }
    const text = readTextFromRecord(container[task]);
    if (text) {
      return text;
    }
  }

  return readTaskTextFromAnswers(payload.answers, task);
}

function copyKnownSubmissionMetadata(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of ["version", "attempt", "startedAt", "submittedAt", "durationSeconds"]) {
    if (payload[key] !== undefined) {
      metadata[key] = payload[key];
    }
  }
  return metadata;
}

function normalizeLegacyWritingSubmissionPayload(
  payload: unknown,
): WritingSubmissionPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const task1Text = readTaskText(payload, "task1");
  const task2Text = readTaskText(payload, "task2");

  if (!task1Text || !task2Text) {
    return null;
  }

  return {
    ...copyKnownSubmissionMetadata(payload),
    task1: { text: task1Text },
    task2: { text: task2Text },
  };
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

export async function loadWritingFeedbackStatusContext(
  params: unknown,
  actor: RequestActor | undefined,
): Promise<{ submissionId: string }> {
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

  assertCanRequestWritingFeedback(submission, actor, "manual");
  const assignmentConfig = parseWritingAssignmentConfig(
    submission.assignment.assignmentConfig,
  );
  assertWritingFeedbackPolicy(submission, assignmentConfig);

  return { submissionId: submission.id };
}
