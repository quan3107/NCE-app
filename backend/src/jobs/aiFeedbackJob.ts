/**
 * File: src/jobs/aiFeedbackJob.ts
 * Purpose: Register and run queued AI feedback generation workers.
 * Why: Provider calls should not block submission, scoring, or teacher workflows.
 */
import PgBoss from "pg-boss";

import { logger } from "../config/logger.js";
import type {
  AiFeedbackJobDeps,
  ObjectiveExplanationJobPayload,
  WritingDraftJobPayload,
} from "./aiFeedbackJob.types.js";
import { AI_FEEDBACK_JOB_NAMES } from "./aiFeedbackJob.types.js";
import {
  processObjectiveExplanationJob,
  processWritingDraftJob,
} from "./aiFeedbackJob.processing.js";
import { withServiceRoleJobHandler } from "./serviceRoleJobHandler.js";

export { AI_FEEDBACK_JOB_NAMES } from "./aiFeedbackJob.types.js";
export {
  enqueueAiFeedbackDraftJob,
  enqueueObjectiveExplanationJob,
} from "./aiFeedbackJob.enqueue.js";

export async function handleGenerateWritingDraftJob(
  jobOrJobs:
    | PgBoss.Job<WritingDraftJobPayload>
    | PgBoss.Job<WritingDraftJobPayload>[],
  deps: AiFeedbackJobDeps = {},
): Promise<void> {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

  for (const job of jobs) {
    await processWritingDraftJob(job, deps);
  }
}

export async function handleGenerateObjectiveExplanationJob(
  jobOrJobs:
    | PgBoss.Job<ObjectiveExplanationJobPayload>
    | PgBoss.Job<ObjectiveExplanationJobPayload>[],
  deps: AiFeedbackJobDeps = {},
): Promise<void> {
  const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

  for (const job of jobs) {
    await processObjectiveExplanationJob(job, deps);
  }
}

export async function registerAiFeedbackJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(AI_FEEDBACK_JOB_NAMES.generateWritingDraft);
  await boss.createQueue(AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation);

  await boss.work(
    AI_FEEDBACK_JOB_NAMES.generateWritingDraft,
    withServiceRoleJobHandler(handleGenerateWritingDraftJob),
  );
  await boss.work(
    AI_FEEDBACK_JOB_NAMES.generateObjectiveExplanation,
    withServiceRoleJobHandler(handleGenerateObjectiveExplanationJob),
  );

  logger.info("AI feedback jobs registered");
}
