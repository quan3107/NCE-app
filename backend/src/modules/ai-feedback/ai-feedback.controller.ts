/**
 * File: src/modules/ai-feedback/ai-feedback.controller.ts
 * Purpose: Serve admin AI feedback readiness checks.
 * Why: Keeps HTTP status mapping separate from provider health evaluation.
 */
import type { NextFunction, Request, Response } from "express";

import {
  aiFeedbackHealthResponseSchema,
  objectiveExplanationResponseSchema,
} from "./ai-feedback.schema.js";
import {
  getAiFeedbackHealth,
  requestAiObjectiveExplanation,
} from "./ai-feedback.service.js";

const unavailableStatuses = new Set(["misconfigured", "timeout", "unhealthy"]);

export async function getAiFeedbackHealthStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const health = aiFeedbackHealthResponseSchema.parse(
      await getAiFeedbackHealth(),
    );
    const statusCode = unavailableStatuses.has(health.status) ? 503 : 200;

    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
}

export async function postObjectiveExplanationRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const explanation = objectiveExplanationResponseSchema.parse(
      await requestAiObjectiveExplanation(req.params, req.user),
    );
    const statusCode = explanation.status === "completed" ? 200 : 202;

    res
      .status(statusCode)
      .location(explanation.pollingLocation)
      .json(explanation);
  } catch (error) {
    next(error);
  }
}
