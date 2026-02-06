/**
 * File: src/server.ts
 * Purpose: Bootstrap the HTTP server for local development and production entry.
 * Why: Ensures the backend runs from TypeScript using the Express app factory.
 */
import { createServer } from "node:http";

import { app } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { startJobRunner } from "./jobs/jobRunner.js";
import { getIeltsConfigReadinessReport } from "./modules/ielts-config/ielts-config.readiness.js";
import { shutdownPrisma } from "./prisma/client.js";

const port = config.port;

const server = createServer(app);

async function runStartupChecks(): Promise<void> {
  const report = await getIeltsConfigReadinessReport();
  if (report.ready) {
    logger.info(
      {
        activeVersion: report.activeVersion,
        counts: report.counts,
      },
      "IELTS configuration readiness check passed",
    );
    return;
  }

  logger.error(
    {
      activeVersion: report.activeVersion,
      counts: report.counts,
      reason: report.reason,
    },
    "IELTS configuration readiness check failed",
  );

  if (config.nodeEnv === "production") {
    throw new Error(
      `Startup blocked: IELTS configuration is not ready. ${report.reason ?? ""}`.trim(),
    );
  }
}

async function bootstrapServer(): Promise<void> {
  try {
    await runStartupChecks();
    server.listen(port, () => {
      logger.info({ port }, "API listening");
    });
    if (config.nodeEnv !== "test") {
      startJobRunner().catch((error) => {
        logger.error({ err: error }, "Failed to start job runner");
      });
    }
  } catch (error) {
    logger.fatal({ err: error }, "Server bootstrap failed");
    process.exit(1);
  }
}

void bootstrapServer();

export { server };

const handleShutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutting down server");
  server.close(async () => {
    try {
      await shutdownPrisma();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error({ err: error }, "Failed to close database connections");
    }
    process.exit(0);
  });
};

process.on("SIGINT", () => void handleShutdown("SIGINT"));
process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
