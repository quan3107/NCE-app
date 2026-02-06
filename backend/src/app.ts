/**
 * File: src/app.ts
 * Purpose: Construct the Express application with core middleware, versioned routes, and error handling.
 * Why: Serves as the single place to compose HTTP concerns before exporting the app factory.
 */
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";

import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rlsContext } from "./middleware/rlsContext.js";
import { getIeltsConfigReadinessReport } from "./modules/ielts-config/ielts-config.readiness.js";
import { apiRouter } from "./modules/router.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path }, "Incoming request");
  next();
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const report = await getIeltsConfigReadinessReport();
    const status = report.ready ? 200 : 503;
    res.status(status).json({
      ok: report.ready,
      checks: {
        ieltsConfig: report,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Health check failed while checking IELTS config");
    res.status(503).json({
      ok: false,
      checks: {
        ieltsConfig: {
          ready: false,
          reason: "Health check query failed.",
        },
      },
    });
  }
});

app.use("/api/v1", rlsContext, apiRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not Found" });
});

app.use(errorHandler);

export { app };
