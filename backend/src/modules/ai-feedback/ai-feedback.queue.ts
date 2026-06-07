/**
 * File: src/modules/ai-feedback/ai-feedback.queue.ts
 * Purpose: Dispatch persisted AI feedback records to pg-boss generation jobs.
 * Why: Keeps repository persistence separate from queue failure handling.
 */
import {
  enqueueAiFeedbackDraftOnActiveQueue,
  enqueueObjectiveExplanationOnActiveQueue,
} from "../../jobs/aiFeedbackJob.enqueue.js";
import { prisma } from "../../prisma/client.js";
import type {
  ObjectiveGenerationJobInput,
  WritingGenerationJobInput,
} from "./ai-feedback.generationJob.schema.js";

function enqueueFailureMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "AI feedback job enqueue failed.";
}

export async function enqueueDraftGenerationJob(
  draftId: string,
  generationJob: WritingGenerationJobInput,
): Promise<void> {
  try {
    await enqueueAiFeedbackDraftOnActiveQueue({
      draftId,
      harnessInput: generationJob.harnessInput,
    });
  } catch (error) {
    await prisma.aiFeedbackDraft.updateMany({
      where: {
        id: draftId,
        status: "queued",
        deletedAt: null,
      },
      data: {
        status: "failed",
        failureCode: "queue_enqueue_failed",
        failureMessage: enqueueFailureMessage(error),
      },
    });
    throw error;
  }
}

export async function enqueueObjectiveExplanationGenerationJob(
  explanationId: string,
  generationJob: ObjectiveGenerationJobInput,
): Promise<void> {
  try {
    await enqueueObjectiveExplanationOnActiveQueue({
      explanationId,
      harnessInput: generationJob.harnessInput,
    });
  } catch (error) {
    await prisma.aiObjectiveExplanation.updateMany({
      where: {
        id: explanationId,
        status: "queued",
        deletedAt: null,
      },
      data: {
        status: "failed",
        failureCode: "queue_enqueue_failed",
        failureMessage: enqueueFailureMessage(error),
      },
    });
    throw error;
  }
}
