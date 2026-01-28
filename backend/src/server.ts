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
import { shutdownPrisma } from "./prisma/client.js";

const port = config.port;

const server = createServer(app);

server.listen(port, () => {
  logger.info({ port }, "API listening");
});

if (config.nodeEnv !== "test") {
  startJobRunner().catch((error) => {
    logger.error({ err: error }, "Failed to start job runner");
  });
}

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
