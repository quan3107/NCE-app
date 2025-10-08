/**
 * File: src/server.ts
 * Purpose: Bootstrap the HTTP server for local development and production entry.
 * Why: Ensures the backend runs from TypeScript using the Express app factory.
 */
import { createServer } from "node:http";

import { app } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";

const port = config.port;

const server = createServer(app);

server.listen(port, () => {
  logger.info({ port }, "API listening");
});

export { server };
