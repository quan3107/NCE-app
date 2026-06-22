/**
 * File: src/modules/nce-content/nce-content-authoring.controller.ts
 * Purpose: Bridge NCE authoring HTTP requests to mutation services.
 * Why: Keeps route declarations thin while enforcing authenticated actors.
 */
import { type Request, type Response } from "express";

import { createHttpError } from "../../utils/httpError.js";
import {
  assignNceLessonsToCourse,
  createNceLesson,
  patchNceLesson,
  publishNceLesson,
  unpublishNceLesson,
} from "./nce-content-authoring.service.js";

function actorFromRequest(req: Request) {
  if (!req.user) {
    throw createHttpError(401, "Unauthorized");
  }

  return req.user;
}

function lessonWriteParams(req: Request) {
  return {
    ...req.params,
    courseId: req.query.courseId,
  };
}

export async function postNceLesson(req: Request, res: Response): Promise<void> {
  const payload = await createNceLesson(
    { courseId: req.query.courseId },
    req.body,
    actorFromRequest(req),
  );
  res.status(201).json(payload);
}

export async function patchNceLessonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await patchNceLesson(lessonWriteParams(req), req.body, actorFromRequest(req));
  res.status(200).json(payload);
}

export async function publishNceLessonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await publishNceLesson(lessonWriteParams(req), actorFromRequest(req));
  res.status(200).json(payload);
}

export async function unpublishNceLessonHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await unpublishNceLesson(lessonWriteParams(req), actorFromRequest(req));
  res.status(200).json(payload);
}

export async function putCourseNceLessons(
  req: Request,
  res: Response,
): Promise<void> {
  const payload = await assignNceLessonsToCourse(
    req.params,
    req.body,
    actorFromRequest(req),
  );
  res.status(200).json(payload);
}
