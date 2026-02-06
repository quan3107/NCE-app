/**
 * File: src/modules/file-upload-config/file-upload-config.routes.ts
 * Purpose: Register file upload configuration endpoints.
 * Why: Keeps endpoint wiring centralized and consistent with other config modules.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import {
  getAllowedFileTypes,
  getFileUploadLimits,
} from "./file-upload-config.controller.js";

export const fileUploadLimitsRouter = Router();
export const fileUploadAllowedTypesRouter = Router();

fileUploadLimitsRouter.use(authGuard);
fileUploadAllowedTypesRouter.use(authGuard);

fileUploadLimitsRouter.get("/", getFileUploadLimits);
fileUploadAllowedTypesRouter.get("/", getAllowedFileTypes);
