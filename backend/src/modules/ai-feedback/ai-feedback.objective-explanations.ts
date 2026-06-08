/**
 * File: src/modules/ai-feedback/ai-feedback.objective-explanations.ts
 * Purpose: Orchestrate on-demand objective explanation requests.
 * Why: Keeps access, deterministic evidence, cache keys, and queue payloads together.
 */
import { createHash } from "node:crypto";

import type { RequestActor } from "../../middleware/requestActor.js";
import { prisma } from "../../prisma/client.js";
import { AssignmentType, EnrollmentRole, UserRole } from "../../prisma/index.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import { parseAssignmentConfigForType } from "../assignments/ielts.schema.js";
import {
  getIeltsQuestionScoringEvidence,
  type IeltsQuestionScoringEvidence,
} from "../scoring/ieltsScoring.utils.js";
import { aiFeedbackConfig } from "./ai-feedback.config.js";
import {
  findAiObjectiveExplanationByCacheKey,
  upsertAiObjectiveExplanation,
} from "./ai-feedback.repository.js";
import { objectiveExplanationRequestParamsSchema } from "./ai-feedback.schema.js";
import type { AiConcreteProviderRouteKey } from "./provider.types.js";
import { OBJECTIVE_EXPLANATION_PROMPT_VERSION } from "./prompts/system.js";

type ObjectiveExplanationAssignmentConfig = {
  version?: number;
  aiPolicy?: {
    writingFeedbackMode?: string;
    objectiveExplanations?: string;
    providerTier?: string;
  };
};

type ObjectiveExplanationResponse = {
  id: string;
  status: string;
  cached: boolean;
  pollingLocation?: string;
  explanation?: unknown;
};

type SubmissionForObjectiveExplanation = {
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

type ObjectiveExplanationContext = {
  submission: SubmissionForObjectiveExplanation;
  questionId: string;
  assignmentConfig: ObjectiveExplanationAssignmentConfig;
  evidence: IeltsQuestionScoringEvidence;
  promptInput: ReturnType<typeof buildObjectivePromptInput>;
  routeKey: AiConcreteProviderRouteKey;
  sourceContextHash: string;
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

function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function hashObjectivePromptInput(promptInput: unknown): string {
  return sha256(promptInput);
}

function assertCanRequestObjectiveExplanation(
  submission: SubmissionForObjectiveExplanation,
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

  if (actor.role === UserRole.student) {
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

function hasDeterministicGrade(
  grade: SubmissionForObjectiveExplanation["grade"],
): boolean {
  return (
    !!grade &&
    grade.deletedAt === null &&
    (grade.rawScore !== null || grade.finalScore !== null || grade.band !== null)
  );
}

function parseObjectiveAssignmentConfig(
  assignmentType: AssignmentType,
  assignmentConfig: unknown,
): ObjectiveExplanationAssignmentConfig {
  return parseAssignmentConfigForType(
    assignmentType,
    assignmentConfig,
  ) as ObjectiveExplanationAssignmentConfig;
}

function assertObjectiveExplanationPolicy(
  assignmentType: AssignmentType,
  assignmentConfig: ObjectiveExplanationAssignmentConfig,
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

  if (
    assignmentConfig.aiPolicy?.objectiveExplanations !==
    "on_demand_student_visible"
  ) {
    throw createHttpError(
      403,
      "Objective explanations are not enabled for this assignment.",
    );
  }
}

function routeKeyForObjectiveExplanation(
  assignmentConfig: ObjectiveExplanationAssignmentConfig,
): AiConcreteProviderRouteKey {
  return assignmentConfig.aiPolicy?.providerTier === "premium"
    ? "premium"
    : "low_cost";
}

function modelForRouteKey(routeKey: AiConcreteProviderRouteKey): string {
  return routeKey === "low_cost"
    ? aiFeedbackConfig.routes.lowCost.model
    : aiFeedbackConfig.routes.premium.model;
}

function assertAiFeedbackGenerationReady(): void {
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

function assertSourceContextSupportsGeneration(
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

function buildObjectivePromptInput(input: {
  submission: SubmissionForObjectiveExplanation;
  assignmentConfig: ObjectiveExplanationAssignmentConfig;
  evidence: IeltsQuestionScoringEvidence;
}) {
  return {
    assignment: {
      title: input.submission.assignment.title,
      type: input.submission.assignment.type as "reading" | "listening",
      config: {
        version: input.assignmentConfig.version ?? 1,
        aiPolicy: input.assignmentConfig.aiPolicy,
      },
    },
    question: {
      id: input.evidence.questionId,
      text: input.evidence.questionText,
      acceptedAnswer: input.evidence.acceptedAnswer,
    },
    studentAnswer: input.evidence.studentAnswer,
    deterministicResult: input.evidence.deterministicResult,
    ...(input.evidence.sourceContext
      ? { sourceContext: input.evidence.sourceContext }
      : {}),
  };
}

function pollingLocation(submissionId: string, questionId: string): string {
  return `/api/v1/submissions/${submissionId}/questions/${questionId}/ai-explanation`;
}

function toObjectiveExplanationResponse(
  explanation: {
    id: string;
    status: string;
    generatedExplanation?: unknown;
  },
  params: {
    submissionId: string;
    questionId: string;
  },
): ObjectiveExplanationResponse {
  const completed =
    explanation.status === "completed" && !!explanation.generatedExplanation;
  const active =
    explanation.status === "queued" || explanation.status === "running";

  return {
    id: explanation.id,
    status: explanation.status,
    cached: completed,
    ...(active
      ? { pollingLocation: pollingLocation(params.submissionId, params.questionId) }
      : {}),
    ...(completed ? { explanation: explanation.generatedExplanation } : {}),
  };
}

async function loadObjectiveExplanationContext(
  params: unknown,
  actor?: RequestActor,
): Promise<ObjectiveExplanationContext & { actor: RequestActor }> {
  const { submissionId, questionId } =
    objectiveExplanationRequestParamsSchema.parse(params);
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      deletedAt: null,
      assignment: {
        deletedAt: null,
        course: {
          deletedAt: null,
        },
      },
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

  assertCanRequestObjectiveExplanation(submission, actor);

  const assignmentConfig = parseObjectiveAssignmentConfig(
    submission.assignment.type,
    submission.assignment.assignmentConfig,
  );
  assertObjectiveExplanationPolicy(submission.assignment.type, assignmentConfig);

  if (!hasDeterministicGrade(submission.grade)) {
    throw createHttpError(
      409,
      "Objective explanations require an existing deterministic score.",
    );
  }

  const evidence = getIeltsQuestionScoringEvidence({
    assignmentType: submission.assignment.type,
    assignmentConfig: submission.assignment.assignmentConfig,
    submissionPayload: submission.payload,
    questionId,
  });

  if (!evidence) {
    throw createHttpError(404, "Question scoring evidence not found.");
  }
  assertSourceContextSupportsGeneration(submission.assignment.type, evidence);

  const promptInput = buildObjectivePromptInput({
    submission,
    assignmentConfig,
    evidence,
  });
  const routeKey = routeKeyForObjectiveExplanation(assignmentConfig);

  return {
    actor,
    submission,
    questionId,
    assignmentConfig,
    evidence,
    promptInput,
    routeKey,
    sourceContextHash: hashObjectivePromptInput(promptInput),
  };
}

export async function requestAiObjectiveExplanation(
  params: unknown,
  actor?: RequestActor,
): Promise<ObjectiveExplanationResponse> {
  const context = await loadObjectiveExplanationContext(params, actor);
  assertAiFeedbackGenerationReady();

  const explanation = await upsertAiObjectiveExplanation({
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    requesterId: context.actor.id,
    questionId: context.questionId,
    deterministicResult: context.evidence.deterministicResult,
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    sourceContextHash: context.sourceContextHash,
    routeKey: context.routeKey,
    provider: aiFeedbackConfig.provider,
    model: modelForRouteKey(context.routeKey),
    status: "queued",
    generationJob: {
      harnessInput: {
        fixtureId: `objective-explanation:${context.submission.id}:${context.questionId}`,
        taskType: "objective_explanation",
        promptInput: context.promptInput,
        routeKey: context.routeKey,
      },
    },
  });

  return toObjectiveExplanationResponse(explanation, {
    submissionId: context.submission.id,
    questionId: context.questionId,
  });
}

export async function getAiObjectiveExplanationStatus(
  params: unknown,
  actor?: RequestActor,
): Promise<ObjectiveExplanationResponse> {
  const context = await loadObjectiveExplanationContext(params, actor);
  const explanation = await findAiObjectiveExplanationByCacheKey({
    submissionId: context.submission.id,
    assignmentId: context.submission.assignmentId,
    requesterId: context.actor.id,
    questionId: context.questionId,
    deterministicResult: context.evidence.deterministicResult,
    promptVersion: OBJECTIVE_EXPLANATION_PROMPT_VERSION,
    sourceContextHash: context.sourceContextHash,
    routeKey: context.routeKey,
  });

  if (!explanation) {
    throw createHttpError(404, "AI objective explanation not found.");
  }

  return toObjectiveExplanationResponse(explanation, {
    submissionId: context.submission.id,
    questionId: context.questionId,
  });
}
