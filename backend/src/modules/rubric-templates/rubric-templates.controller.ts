/**
 * File: src/modules/rubric-templates/rubric-templates.controller.ts
 * Purpose: Expose rubric template reads through HTTP handlers.
 * Why: Keeps transport concerns separate from template and access-resolution logic.
 */
import type { Request, Response } from "express";

import { createHttpError } from "../../utils/httpError.js";
import {
  getCourseDefaultRubricTemplate,
  listDefaultRubrics,
  listRubricTemplates,
} from "./rubric-templates.service.js";

export async function getDefaultRubrics(
  req: Request,
  res: Response,
): Promise<void> {
  const templates = await listDefaultRubrics(req.query);
  res.status(200).json(templates);
}

export async function getCourseDefaultTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  const template = await getCourseDefaultRubricTemplate(req.params, req.user);
  res.status(200).json(template);
}

export async function getRubricTemplates(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  const templates = await listRubricTemplates(req.query, req.user);
  res.status(200).json(templates);
}
