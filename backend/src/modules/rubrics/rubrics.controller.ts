/**
 * File: src/modules/rubrics/rubrics.controller.ts
 * Purpose: Expose rubric operations over HTTP via controller handlers.
 * Why: Keeps routing declarative while services handle persistence details.
 */
import { type Request, type Response } from "express";

import { createHttpError } from "../../utils/httpError.js";
import { createRubric, listRubrics } from "./rubrics.service.js";

export async function getRubrics(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  const rubrics = await listRubrics(req.params, req.user);
  res.status(200).json(rubrics);
}

export async function postRubric(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  const rubric = await createRubric(req.params, req.body, req.user);
  res.status(201).json(rubric);
}
