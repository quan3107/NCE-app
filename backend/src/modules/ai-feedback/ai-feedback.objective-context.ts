/**
 * File: src/modules/ai-feedback/ai-feedback.objective-context.ts
 * Purpose: Load and validate deterministic objective-explanation context.
 * Why: Access, ownership, payload eligibility, and prompt hashing are one boundary.
 */
import { createHash } from "node:crypto";

import { ZodError } from "zod";

import type { RequestActor } from "../../middleware/requestActor.js";
import { prisma } from "../../prisma/client.js";
import {
  AssignmentType,
  EnrollmentRole,
  UserRole,
} from "../../prisma/index.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import { parseAssignmentConfigForType } from "../assignments/ielts.schema.js";
import {
  getIeltsQuestionScoringEvidence,
  type IeltsQuestionScoringEvidence,
} from "../scoring/ieltsScoring.utils.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import { objectiveExplanationRequestParamsSchema } from "./ai-feedback.schema.js";
import type { AiConcreteProviderRouteKey } from "./provider.types.js";

type ObjectiveAssignmentConfig = {
  version?: number;
  aiPolicy?: {
    writingFeedbackMode?: string;
    objectiveExplanations?: string;
    providerTier?: string;
  };
};

type ObjectiveSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  payload: unknown;
  grade: {
    rawScore: unknown;
    finalScore: unknown;
    band: unknown;
    deletedAt: Date | null;
  } | null;
  assignment: {
    id: string;
    title: string;
    type: AssignmentType;
    assignmentConfig: unknown;
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function promptHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function assertAccess(
  submission: ObjectiveSubmission,
  actor: RequestActor | undefined,
): asserts actor is RequestActor {
  if (!actor) {
    throw createHttpError(
      401,
      "Authentication is required to request objective explanations.",
    );
  }
  if (actor.role === UserRole.admin) {
    return;
  }
  if (actor.role === UserRole.student && submission.studentId === actor.id) {
    return;
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

function assertPolicy(
  assignmentType: AssignmentType,
  config: ObjectiveAssignmentConfig,
): void {
  if (
    assignmentType !== AssignmentType.reading &&
    assignmentType !== AssignmentType.listening
  ) {
    throw createHttpError(
      400,
      "Objective explanations are only available for reading and listening assignments.",
    );
  }
  if (config.aiPolicy?.objectiveExplanations !== "on_demand_student_visible") {
    throw createHttpError(
      403,
      "Objective explanations are not enabled for this assignment.",
    );
  }
}

function assertGrade(grade: ObjectiveSubmission["grade"]): void {
  const valid =
    !!grade &&
    grade.deletedAt === null &&
    (grade.rawScore !== null ||
      grade.finalScore !== null ||
      grade.band !== null);
  if (!valid) {
    throw createHttpError(
      409,
      "Objective explanations require an existing deterministic score.",
    );
  }
}

function objectiveEvidence(
  submission: ObjectiveSubmission,
  questionId: string,
): IeltsQuestionScoringEvidence | null {
  try {
    return getIeltsQuestionScoringEvidence({
      assignmentType: submission.assignment.type,
      assignmentConfig: submission.assignment.assignmentConfig,
      submissionPayload: submission.payload,
      questionId,
    });
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error;
    }
    throw createHttpError(
      409,
      "Objective explanations are unavailable because this submission has no structured answers.",
    );
  }
}

function assertSourceContext(
  assignmentType: AssignmentType,
  evidence: IeltsQuestionScoringEvidence,
): void {
  if (
    assignmentType === AssignmentType.reading &&
    evidence.sourceContext?.kind !== "reading_passage"
  ) {
    throw createHttpError(
      409,
      "Reading objective explanations require passage source context.",
    );
  }
  if (
    assignmentType === AssignmentType.listening &&
    evidence.sourceContext?.kind !== "listening_transcript"
  ) {
    throw createHttpError(
      409,
      "Listening objective explanations require transcript source context.",
    );
  }
}

function buildPromptInput(
  submission: ObjectiveSubmission,
  config: ObjectiveAssignmentConfig,
  evidence: IeltsQuestionScoringEvidence,
) {
  return {
    assignment: {
      title: submission.assignment.title,
      type: submission.assignment.type as "reading" | "listening",
      config: { version: config.version ?? 1, aiPolicy: config.aiPolicy },
    },
    question: {
      id: evidence.questionId,
      text: evidence.questionText,
      acceptedAnswer: evidence.acceptedAnswer,
    },
    studentAnswer: evidence.studentAnswer,
    deterministicResult: evidence.deterministicResult,
    sourceEvidenceCandidates: evidence.sourceEvidenceCandidates,
    ...(evidence.sourceContext
      ? { sourceContext: evidence.sourceContext }
      : {}),
  };
}

export function modelForObjectiveRoute(
  routeKey: AiConcreteProviderRouteKey,
): string {
  return routeKey === "low_cost"
    ? aiFeedbackConfig.routes.lowCost.model
    : aiFeedbackConfig.routes.premium.model;
}

export function assertObjectiveGenerationReady(): void {
  if (!aiFeedbackConfig.enabled) {
    throw createHttpError(503, "AI feedback generation is disabled.");
  }
  if (!aiFeedbackConfig.apiKey) {
    throw createHttpError(503, "AI feedback provider is not configured.");
  }
  try {
    const baseUrl = new URL(aiFeedbackConfig.baseUrl);
    if (!["http:", "https:"].includes(baseUrl.protocol)) {
      throw new Error("Unsupported AI provider protocol.");
    }
  } catch {
    throw createHttpError(503, "AI feedback provider is not configured.");
  }
}

export function hasObjectiveSourceEvidence(
  evidence: IeltsQuestionScoringEvidence,
): boolean {
  return (
    evidence.sourceEvidenceStatus === "available" &&
    evidence.sourceEvidenceCandidates.length > 0
  );
}

export async function loadObjectiveExplanationContext(
  params: unknown,
  actor?: RequestActor,
) {
  const { submissionId, questionId } =
    objectiveExplanationRequestParamsSchema.parse(params);
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
      payload: true,
      grade: {
        select: {
          rawScore: true,
          finalScore: true,
          band: true,
          deletedAt: true,
        },
      },
      assignment: {
        select: {
          id: true,
          title: true,
          type: true,
          assignmentConfig: true,
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
                select: { userId: true, roleInCourse: true, deletedAt: true },
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

  assertAccess(submission, actor);
  const config = parseAssignmentConfigForType(
    submission.assignment.type,
    submission.assignment.assignmentConfig,
  ) as ObjectiveAssignmentConfig;
  assertPolicy(submission.assignment.type, config);
  assertGrade(submission.grade);
  const evidence = objectiveEvidence(submission, questionId);
  if (!evidence) {
    throw createHttpError(404, "Question scoring evidence not found.");
  }
  assertSourceContext(submission.assignment.type, evidence);
  const promptInput = buildPromptInput(submission, config, evidence);
  const routeKey: AiConcreteProviderRouteKey =
    config.aiPolicy?.providerTier === "premium" ? "premium" : "low_cost";

  return {
    actor,
    submission,
    questionId,
    assignmentConfig: config,
    evidence,
    promptInput,
    routeKey,
    sourceContextHash: promptHash(promptInput),
  };
}
