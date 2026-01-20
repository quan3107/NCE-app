/**
 * File: src/modules/files/files.routes.ts
 * Purpose: Register file upload signing and completion endpoints.
 * Why: Centralizes file-related routes under the versioned API router.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { postFileComplete, postFileSign } from "./files.controller.js";

export const fileRouter = Router();

fileRouter.use(authGuard);

fileRouter.post("/sign", postFileSign);
fileRouter.post("/complete", postFileComplete);
