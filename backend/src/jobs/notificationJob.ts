/**
 * File: src/jobs/notificationJob.ts
 * Purpose: Register pg-boss workers for notification scheduling and delivery.
 * Why: Keeps job registration logic focused while handlers live in their own module.
 */
import PgBoss from "pg-boss";

import { logger } from "../config/logger.js";
import {
  handleDueSoonJob,
  handleWeeklyDigestJob,
  NOTIFICATION_JOB_NAMES,
} from "./notificationHandlers.js";
import { handleDeliverQueuedJob } from "./notificationDelivery.js";

export async function registerNotificationJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(NOTIFICATION_JOB_NAMES.dueSoon);
  await boss.createQueue(NOTIFICATION_JOB_NAMES.weeklyDigest);
  await boss.createQueue(NOTIFICATION_JOB_NAMES.deliverQueued);

  await boss.work(NOTIFICATION_JOB_NAMES.dueSoon, handleDueSoonJob);
  await boss.work(NOTIFICATION_JOB_NAMES.weeklyDigest, handleWeeklyDigestJob);
  await boss.work(
    NOTIFICATION_JOB_NAMES.deliverQueued,
    handleDeliverQueuedJob,
  );

  await boss.schedule(NOTIFICATION_JOB_NAMES.dueSoon, "0 * * * *");
  await boss.schedule(NOTIFICATION_JOB_NAMES.weeklyDigest, "0 7 * * 1");
  await boss.schedule(NOTIFICATION_JOB_NAMES.deliverQueued, "*/1 * * * *");

  logger.info("Notification jobs registered");
}
