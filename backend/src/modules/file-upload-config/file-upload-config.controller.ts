/**
 * File: src/modules/file-upload-config/file-upload-config.controller.ts
 * Purpose: Handle HTTP requests for role-based file upload configuration endpoints.
 * Why: Keeps transport handling separate from policy lookup logic.
 */

import type { Request, Response } from "express";

import {
  allowedFileTypesResponseSchema,
  fileUploadLimitsResponseSchema,
} from "./file-upload-config.schema.js";
import {
  getAllowedFileTypesForRole,
  getFileUploadLimitsForRole,
} from "./file-upload-config.service.js";

export async function getFileUploadLimits(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getFileUploadLimitsForRole(user.role);
  res.status(200).json(fileUploadLimitsResponseSchema.parse(payload));
}

export async function getAllowedFileTypes(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = await getAllowedFileTypesForRole(user.role);
  res.status(200).json(allowedFileTypesResponseSchema.parse(payload));
}
