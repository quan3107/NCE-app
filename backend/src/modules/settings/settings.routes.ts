/**
 * File: src/modules/settings/settings.routes.ts
 * Purpose: Register admin-only runtime setting routes.
 * Why: Only active administrators may change shared upload enforcement.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { UserRole } from "../../prisma/index.js";
import {
  getUploadLimits,
  updateUploadLimits,
} from "./settings.controller.js";

export const settingsRouter = Router();

settingsRouter.use(authGuard);
settingsRouter.use(roleGuard([UserRole.admin]));
settingsRouter.get("/file-upload-limits", getUploadLimits);
settingsRouter.patch("/file-upload-limits", updateUploadLimits);
