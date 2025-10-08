/**
 * File: src/jobs/cleanupJob.ts
 * Purpose: Placeholder maintenance tasks to prune expired records and keep storage tidy.
 * Why: Allocates a dedicated module for scheduled cleanup so production scripts have a stable hook.
 */
import { logger } from "../config/logger.js";

export async function purgeExpiredSessions(): Promise<void> {
  logger.warn("purgeExpiredSessions job not implemented yet");
}

export async function purgeSoftDeletedEntities(): Promise<void> {
  logger.warn("purgeSoftDeletedEntities job not implemented yet");
}
