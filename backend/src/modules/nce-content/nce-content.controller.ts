/**
 * File: src/modules/nce-content/nce-content.controller.ts
 * Purpose: Bridge NCE content HTTP requests to read services.
 * Why: Keeps route declarations thin while supporting optional public auth.
 */
import { type Request, type Response } from "express";

import {
  isActiveActor,
  resolveRequestActor,
  type RequestActor,
} from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  getNceLesson as readNceLesson,
  listCourseNceLessons,
  listNceBooks,
  listNceLessons,
  listNceUnits,
} from "./nce-content.service.js";

function optionalActor(req: Request): RequestActor | undefined {
  const resolved = resolveRequestActor(req);

  if (resolved.kind === "invalid") {
    throw createHttpError(401, "Unauthorized");
  }

  if (resolved.kind === "anonymous") {
    return undefined;
  }

  if (!isActiveActor(resolved.actor)) {
    throw createHttpError(403, "Forbidden");
  }

  return resolved.actor;
}

export async function getNceBooks(req: Request, res: Response): Promise<void> {
  const payload = await listNceBooks(optionalActor(req), req.query);
  res.status(200).json(payload);
}

export async function getNceUnits(req: Request, res: Response): Promise<void> {
  const payload = await listNceUnits(req.params, optionalActor(req), req.query);
  res.status(200).json(payload);
}

export async function getNceLessons(req: Request, res: Response): Promise<void> {
  const payload = await listNceLessons(req.params, optionalActor(req), req.query);
  res.status(200).json(payload);
}

export async function getNceLesson(req: Request, res: Response): Promise<void> {
  const payload = await readNceLesson(req.params, optionalActor(req), req.query);
  res.status(200).json(payload);
}

export async function getCourseNceLessons(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  const payload = await listCourseNceLessons(req.params, req.user, req.query);
  res.status(200).json(payload);
}
