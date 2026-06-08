/**
 * File: src/jobs/aiFeedbackJob.enqueue.ts
 * Purpose: Enqueue AI feedback jobs on explicit or active pg-boss queues.
 * Why: Persistence paths must dispatch queued records instead of leaving them idle.
 */
import type PgBoss from "pg-boss";

import {
  AI_FEEDBACK_JOB_NAMES,
  AI_FEEDBACK_JOB_OPTIONS,
  type ObjectiveExplanationJobPayload,
  type WritingDraftJobPayload,
} from "./aiFeedbackJob.types.js";

let activeJobBoss: PgBoss | null = null;

export function setJobRunnerBoss(boss: PgBoss): void {
  activeJobBoss = boss;
}

export function clearJobRunnerBoss(): void {
  activeJobBoss = null;
}

export function getJobRunnerBoss(): PgBoss | null {
  return activeJobBoss;
}

function requireActiveBoss(): PgBoss {
  const boss = getJobRunnerBoss();

  if (!boss) {
    throw new Error("AI feedback job queue is not available.");
  }

  return boss;
}

export async function enqueueAiFeedbackDraftJob(
  boss: PgBoss,
  payload: WritingDraftJobPayload,
): Promise<string | null> {
  return boss.send(
    AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
    payload,
    AI_FEEDBACK_JOB_OPTIONS,
  );
}

export async function enqueueObjectiveExplanationJob(
  boss: PgBoss,
  payload: ObjectiveExplanationJobPayload,
): Promise<string | null> {
  return boss.send(
    AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
    payload,
    AI_FEEDBACK_JOB_OPTIONS,
  );
}

export async function enqueueAiFeedbackDraftOnActiveQueue(
  payload: WritingDraftJobPayload,
): Promise<string | null> {
  return enqueueAiFeedbackDraftJob(requireActiveBoss(), payload);
}

export async function enqueueObjectiveExplanationOnActiveQueue(
  payload: ObjectiveExplanationJobPayload,
): Promise<string | null> {
  return enqueueObjectiveExplanationJob(requireActiveBoss(), payload);
}
