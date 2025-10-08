/**
 * File: src/modules/auth/auth.routes.ts
 * Purpose: Register authentication HTTP routes on the Express router.
 * Why: Keeps routing definitions isolated from middleware wiring for clarity.
 */
import { Router } from "express";

import {
  completeGoogleAuth,
  logout,
  passwordLogin,
  refreshSession,
  startGoogleAuth,
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", passwordLogin);
authRouter.post("/refresh", refreshSession);
authRouter.post("/logout", logout);
authRouter.get("/google", startGoogleAuth);
authRouter.get("/google/callback", completeGoogleAuth);
