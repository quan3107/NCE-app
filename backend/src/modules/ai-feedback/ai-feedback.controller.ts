/**
 * File: src/modules/ai-feedback/ai-feedback.controller.ts
 * Purpose: Serve admin AI feedback readiness checks.
 * Why: Keeps HTTP status mapping separate from provider health evaluation.
 */
import type { NextFunction, Request, Response } from "express";

import {
  aiFeedbackHealthResponseSchema,
  objectiveExplanationResponseSchema,
  writingFeedbackResponseSchema,
} from "./ai-feedback.schema.js";
import {
  getAiFeedbackHealth,
  getAiObjectiveExplanationStatus,
  getAiWritingFeedbackStatus,
  requestAiWritingFeedback,
  requestAiObjectiveExplanation,
} from "./ai-feedback.service.js";

const unavailableStatuses = new Set(["misconfigured", "timeout", "unhealthy"]);
const activeExplanationStatuses = new Set(["queued", "running"]);
const activeWritingStatuses = new Set(["queued", "running"]);

function objectiveExplanationStatusCode(status: string): number {
  if (status === "completed") {
    return 200;
  }

  return activeExplanationStatuses.has(status) ? 202 : 409;
}

function writingFeedbackStatusCode(status: string): number {
  if (status === "accepted" || status === "approved" || status === "finalized") {
    return 200;
  }

  return activeWritingStatuses.has(status) ? 202 : 409;
}

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
    const statusCode = objectiveExplanationStatusCode(explanation.status);
    const response = res.status(statusCode);

    if (statusCode === 202 && explanation.pollingLocation) {
      response.location(explanation.pollingLocation);
    }

    response.json(explanation);
  } catch (error) {
    next(error);
  }
}

export async function getObjectiveExplanationStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const explanation = objectiveExplanationResponseSchema.parse(
      await getAiObjectiveExplanationStatus(req.params, req.user),
    );

    res
      .status(objectiveExplanationStatusCode(explanation.status))
      .json(explanation);
  } catch (error) {
    next(error);
  }
}

export async function postWritingFeedbackRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const draft = writingFeedbackResponseSchema.parse(
      await requestAiWritingFeedback(req.params, req.user),
    );
    const statusCode = writingFeedbackStatusCode(draft.status);
    const response = res.status(statusCode);

    if (statusCode === 202 && draft.pollingLocation) {
      response.location(draft.pollingLocation);
    }

    response.json(draft);
  } catch (error) {
    next(error);
  }
}

export async function getWritingFeedbackStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const draft = writingFeedbackResponseSchema.parse(
      await getAiWritingFeedbackStatus(req.params, req.user),
    );

    res.status(writingFeedbackStatusCode(draft.status)).json(draft);
  } catch (error) {
    next(error);
  }
}
