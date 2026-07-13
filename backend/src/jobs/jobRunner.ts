/**
 * File: src/jobs/jobRunner.ts
 * Purpose: Start and stop the pg-boss worker used by background jobs.
 * Why: Keeps job bootstrap logic separate from the HTTP server entry point.
 */
import PgBoss from "pg-boss";

import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { registerAiFeedbackJobs } from "./aiFeedbackJob.js";
import {
  clearJobRunnerBoss,
  setJobRunnerBoss,
} from "./aiFeedbackJob.enqueue.js";
import { registerCleanupJobs } from "./cleanupJob.js";
import { registerNotificationJobs } from "./notificationJob.js";

let bossInstance: PgBoss | null = null;

export async function startJobRunner(): Promise<void> {
  if (bossInstance) {
    return;
  }

  const boss = new PgBoss({
    connectionString: config.jobDatabaseUrl,
    application_name: "nce-app-jobs",
    // Schema installation and upgrades run separately with DIRECT_URL.
    migrate: false,
  });

  boss.on("error", (error) => {
    logger.error({ err: error }, "pg-boss encountered an error");
  });

  await boss.start();
  await registerAiFeedbackJobs(boss);
  await registerNotificationJobs(boss);
  await registerCleanupJobs(boss);

  bossInstance = boss;
  setJobRunnerBoss(boss);
  logger.info("Job runner started");
}

export async function stopJobRunner(): Promise<void> {
  if (!bossInstance) {
    return;
  }

  await bossInstance.stop();
  bossInstance = null;
  clearJobRunnerBoss();
  logger.info("Job runner stopped");
}
