/**
 * File: src/modules/me/me.routes.ts
 * Purpose: Register the authenticated profile route.
 * Why: Exposes /me under the versioned API router.
 */
import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { getMe } from "./me.controller.js";

export const meRouter = Router();

meRouter.use(authGuard);

meRouter.get("/", getMe);
