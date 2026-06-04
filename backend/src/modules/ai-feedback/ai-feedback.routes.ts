/**
 * File: src/modules/ai-feedback/ai-feedback.routes.ts
 * Purpose: Register AI feedback administrative endpoints.
 * Why: Keeps AI provider readiness details behind admin authentication.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { UserRole } from "../../prisma/index.js";
import { getAiFeedbackHealthStatus } from "./ai-feedback.controller.js";

export const aiFeedbackRouter = Router();

aiFeedbackRouter.use(authGuard);
aiFeedbackRouter.use(roleGuard([UserRole.admin]));
aiFeedbackRouter.get("/health", getAiFeedbackHealthStatus);
