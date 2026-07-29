/**
 * File: src/modules/settings/settings.controller.ts
 * Purpose: Serve admin-managed runtime setting endpoints.
 * Why: HTTP validation and response shaping should stay separate from persistence.
 */
import type { Request, Response } from "express";

import {
  fileUploadLimitsResponseSchema,
  updateFileUploadLimitsSchema,
} from "./settings.schema.js";
import {
  getFileUploadLimits,
  updateFileUploadLimits,
} from "./settings.service.js";

export async function getUploadLimits(
  _req: Request,
  res: Response,
): Promise<void> {
  const payload = await getFileUploadLimits();
  res.status(200).json(fileUploadLimitsResponseSchema.parse(payload));
}

export async function updateUploadLimits(
  req: Request,
  res: Response,
): Promise<void> {
  const actor = req.user;
  if (!actor) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const input = updateFileUploadLimitsSchema.parse(req.body);
  const payload = await updateFileUploadLimits(input, actor.id);
  res.status(200).json(fileUploadLimitsResponseSchema.parse(payload));
}
