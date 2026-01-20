/**
 * File: src/jobs/jobRunner.ts
 * Purpose: Start and stop the pg-boss worker used by background jobs.
 * Why: Keeps job bootstrap logic separate from the HTTP server entry point.
 */
import PgBoss from "pg-boss";

import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { registerNotificationJobs } from "./notificationJob.js";

let bossInstance: PgBoss | null = null;

export async function startJobRunner(): Promise<void> {
  if (bossInstance) {
    return;
  }

  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    application_name: "nce-app-jobs",
  });

  boss.on("error", (error) => {
    logger.error({ err: error }, "pg-boss encountered an error");
  });

  await boss.start();
  await registerNotificationJobs(boss);

  bossInstance = boss;
  logger.info("Job runner started");
}

export async function stopJobRunner(): Promise<void> {
  if (!bossInstance) {
    return;
  }

  await bossInstance.stop();
  bossInstance = null;
  logger.info("Job runner stopped");
}
