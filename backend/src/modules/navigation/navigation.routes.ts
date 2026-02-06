/**
 * File: src/modules/navigation/navigation.routes.ts
 * Purpose: Register navigation-related endpoints.
 * Why: Exposes navigation configuration via the API.
 */

import { Router } from "express";

import { authGuard } from "../../middleware/authGuard.js";
import { getNavigation } from "./navigation.controller.js";

export const navigationRouter = Router();

navigationRouter.use(authGuard);

navigationRouter.get("/", getNavigation);
