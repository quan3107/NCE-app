/**
 * File: src/jobs/jobQueue.ts
 * Purpose: Share the active pg-boss instance with enqueue-only modules.
 * Why: Record creation paths need to enqueue jobs without owning worker startup.
 */
import type PgBoss from "pg-boss";

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
