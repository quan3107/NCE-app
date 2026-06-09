/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.types.ts
 * Purpose: Share IELTS writing AI feedback orchestration types.
 * Why: Keeps context loading and draft creation modules small and aligned.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import type { AssignmentType, EnrollmentRole } from "../../prisma/index.js";
import type { AiConcreteProviderRouteKey } from "./provider.types.js";
import type { IeltsWritingFeedbackPromptInput } from "./prompts/ielts-writing.js";

export type WritingAiPolicy = {
  writingFeedbackMode?: "off" | "teacher_reviewed" | "instant_student_visible";
  objectiveExplanations?: string;
  providerTier?: "auto" | AiConcreteProviderRouteKey;
};

export type WritingAssignmentConfig = {
  version?: number;
  instructions?: string;
  aiPolicy?: WritingAiPolicy;
  task1: {
    prompt: string;
    imageFileId?: string | null;
    visualType?: string;
    rubricId?: string | null;
  };
  task2: {
    prompt: string;
    rubricId?: string | null;
  };
};

export type WritingSubmissionPayload = {
  task1?: {
    text?: string;
  };
  task2?: {
    text?: string;
  };
};

export type WritingSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: string;
  payload: unknown;
  grade: {
    id: string;
    rawScore: unknown;
    finalScore: unknown;
    band: unknown;
    feedback: string | null;
    deletedAt: Date | null;
  } | null;
  assignment: {
    id: string;
    title: string;
    type: AssignmentType;
    assignmentConfig: unknown;
    courseId: string;
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

export type WritingFeedbackContext = {
  actor: RequestActor;
  submission: WritingSubmission;
  assignmentConfig: WritingAssignmentConfig;
  submissionPayload: WritingSubmissionPayload;
  promptInput: IeltsWritingFeedbackPromptInput;
  routeKey: AiConcreteProviderRouteKey;
  visibilityMode: "teacher_reviewed" | "instant_student_visible";
  inputHash: string;
};

export type WritingFeedbackRequestMode = "manual" | "automatic";

export type WritingFeedbackDraftForResponse = {
  id: string;
  submissionId: string;
  status: string;
  visibilityMode: "teacher_reviewed" | "instant_student_visible" | "hidden";
  generatedFeedback?: unknown;
  failureCode?: string | null;
  failureMessage?: string | null;
};
