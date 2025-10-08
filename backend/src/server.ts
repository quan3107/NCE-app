/**
 * File: src/server.ts
 * Purpose: Bootstrap the HTTP server for local development and production entry.
 * Why: Ensures the backend runs from TypeScript using the Express app factory.
 */
import { createServer } from "node:http";

import { app } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer(app);

server.listen(port, () => {
  console.info(`API listening on http://localhost:${port}`);
});

export { server };
