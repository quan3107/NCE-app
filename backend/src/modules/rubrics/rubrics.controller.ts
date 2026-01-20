/**
 * File: src/modules/rubrics/rubrics.controller.ts
 * Purpose: Expose rubric operations over HTTP via controller handlers.
 * Why: Keeps routing declarative while services handle persistence details.
 */
import { type Request, type Response } from "express";

import { createRubric, listRubrics } from "./rubrics.service.js";

export async function getRubrics(
  req: Request,
  res: Response,
): Promise<void> {
  const rubrics = await listRubrics(req.params);
  res.status(200).json(rubrics);
}

export async function postRubric(
  req: Request,
  res: Response,
): Promise<void> {
  const rubric = await createRubric(req.params, req.body);
  res.status(201).json(rubric);
}
