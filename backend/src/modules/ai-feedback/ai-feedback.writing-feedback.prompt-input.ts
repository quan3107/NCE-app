/**
 * File: src/modules/ai-feedback/ai-feedback.writing-feedback.prompt-input.ts
 * Purpose: Build IELTS writing AI prompt input from submission context.
 * Why: Keeps rubric and image context assembly separate from request loading.
 */
import type { RequestActor } from "../../middleware/requestActor.js";
import { prisma } from "../../prisma/client.js";
import { resolveAiFeedbackImageContext } from "./image-context.js";
import { stableJson } from "./ai-feedback.writing-feedback.support.js";
import type {
  WritingAssignmentConfig,
  WritingSubmission,
  WritingSubmissionPayload,
} from "./ai-feedback.writing-feedback.types.js";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactJson(value: unknown): string {
  const text = stableJson(value);
  return text.length > 600 ? `${text.slice(0, 600)}...` : text;
}

function gradeConstraint(grade: WritingSubmission["grade"]): string | null {
  if (!grade || grade.deletedAt !== null) {
    return null;
  }

  const parts = [
    grade.band !== null ? `band ${String(grade.band)}` : null,
    grade.finalScore !== null ? `final score ${String(grade.finalScore)}` : null,
    grade.rawScore !== null ? `raw score ${String(grade.rawScore)}` : null,
  ].filter((value): value is string => value !== null);

  if (parts.length === 0 && !grade.feedback) {
    return null;
  }

  return [
    parts.length > 0 ? `Existing teacher grade: ${parts.join(", ")}.` : null,
    grade.feedback ? `Existing teacher feedback: ${grade.feedback}` : null,
    "AI feedback is advisory and must not overwrite the teacher-final grade.",
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

async function loadRubricConstraints(
  assignmentConfig: WritingAssignmentConfig,
  courseId: string,
): Promise<string[]> {
  const rubricIds = [
    assignmentConfig.task1.rubricId,
    assignmentConfig.task2.rubricId,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (rubricIds.length === 0) {
    return [];
  }

  const rubrics = await prisma.rubric.findMany({
    where: {
      id: { in: Array.from(new Set(rubricIds)) },
      courseId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      criteria: true,
    },
  });

  return rubrics.map(
    (rubric) =>
      `Teacher rubric context (${rubric.name}, ${rubric.id}): ${compactJson(
        rubric.criteria,
      )}`,
  );
}

async function resolveTask1ImageContext(
  assignmentConfig: WritingAssignmentConfig,
  actor: RequestActor,
) {
  const imageFileId = assignmentConfig.task1.imageFileId;
  const visualType = cleanText(assignmentConfig.task1.visualType);
  const isVisualTask = visualType.length > 0 || !!imageFileId;

  if (!isVisualTask) {
    return undefined;
  }

  if (!imageFileId) {
    return {
      status: "image_unavailable" as const,
      reason: "Task 1 is visual, but no image file is attached.",
    };
  }

  try {
    const image = await resolveAiFeedbackImageContext(imageFileId, actor);
    return { status: "image_attached" as const, image };
  } catch (error) {
    return {
      status: "image_unavailable" as const,
      reason:
        error instanceof Error
          ? error.message
          : "Task 1 image context is unavailable.",
    };
  }
}

export async function buildWritingPromptInput(input: {
  submission: WritingSubmission;
  assignmentConfig: WritingAssignmentConfig;
  submissionPayload: WritingSubmissionPayload;
  actor: RequestActor;
}) {
  const [task1ImageContext, rubricConstraints] = await Promise.all([
    resolveTask1ImageContext(input.assignmentConfig, input.actor),
    loadRubricConstraints(
      input.assignmentConfig,
      input.submission.assignment.courseId,
    ),
  ]);
  const constraints = [
    gradeConstraint(input.submission.grade),
    ...rubricConstraints,
  ].filter((value): value is string => value !== null);

  return {
    assignment: {
      title: input.submission.assignment.title,
      type: "writing" as const,
      config: {
        version: input.assignmentConfig.version ?? 1,
        instructions: input.assignmentConfig.instructions,
        aiPolicy: input.assignmentConfig.aiPolicy,
      },
    },
    tasks: {
      task1: {
        prompt: input.assignmentConfig.task1.prompt,
        visualType: input.assignmentConfig.task1.visualType,
        ...(task1ImageContext ? { imageContext: task1ImageContext } : {}),
      },
      task2: { prompt: input.assignmentConfig.task2.prompt },
    },
    submission: {
      task1: { text: input.submissionPayload.task1?.text },
      task2: { text: input.submissionPayload.task2?.text },
    },
    ...(constraints.length > 0 ? { teacherConstraints: constraints } : {}),
  };
}
