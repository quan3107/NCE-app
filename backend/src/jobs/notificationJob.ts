/**
 * File: src/jobs/notificationJob.ts
 * Purpose: Outline the notification dispatch worker that will fan out reminders via pg-boss.
 * Why: Defines a predictable job hook while business logic is still pending.
 */
import { logger } from "../config/logger.js";

export async function queueDueSoonReminders(): Promise<void> {
  logger.warn("queueDueSoonReminders job not implemented yet");
}

export async function queueWeeklyDigest(): Promise<void> {
  logger.warn("queueWeeklyDigest job not implemented yet");
}
