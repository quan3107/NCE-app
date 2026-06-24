/**
 * File: src/modules/nce-attempts/nce-attempts.controller.ts
 * Purpose: Bridge NCE learning HTTP requests to attempt services.
 * Why: Keeps route declarations thin and auth handling centralized.
 */
import { type Request, type Response } from "express";

import { createHttpError } from "../../utils/httpError.js";
import {
  completeNceLesson,
  createOrUpdateNceAttempt,
  getNceAssetContentLocation,
  listStudentNcePath,
  listTeacherNceAttemptSummaries,
  submitNceAttempt,
} from "./nce-attempts.service.js";

function actor(req: Request) {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  return req.user;
}

export async function getStudentNcePath(req: Request, res: Response): Promise<void> {
  const payload = await listStudentNcePath(req.params, actor(req), req.query);
  res.status(200).json(payload);
}

export async function getNceAssetContent(req: Request, res: Response): Promise<void> {
  const payload = await getNceAssetContentLocation(req.params, req.query, actor(req));
  res.status(200).json(payload);
}

export async function postNceAttempt(req: Request, res: Response): Promise<void> {
  const payload = await createOrUpdateNceAttempt(req.params, req.body, actor(req));
  res.status(200).json(payload);
}

export async function postSubmitNceAttempt(req: Request, res: Response): Promise<void> {
  const payload = await submitNceAttempt(req.params, actor(req));
  res.status(200).json(payload);
}

export async function postCompleteNceLesson(req: Request, res: Response): Promise<void> {
  const payload = await completeNceLesson(req.params, actor(req));
  res.status(200).json(payload);
}

export async function getNceAttemptSummaries(req: Request, res: Response): Promise<void> {
  const payload = await listTeacherNceAttemptSummaries(req.params, actor(req), req.query);
  res.status(200).json(payload);
}
