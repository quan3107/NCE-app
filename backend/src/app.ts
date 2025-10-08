/**
 * File: src/app.ts
 * Purpose: Construct the Express application with core middleware and health-check route.
 * Why: Provides a typed entry point for all HTTP handling in the backend service.
 */
import express, { type Request, type Response } from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

export { app };
