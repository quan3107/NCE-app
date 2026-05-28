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
  registerAccount,
  refreshSession,
  startGoogleAuth,
} from "./auth.controller.js";
import { limitAuthRoute } from "./auth.rate-limit.js";

export const authRouter = Router();

authRouter.post("/login", passwordLogin);
authRouter.post("/register", limitAuthRoute("register"), registerAccount);
authRouter.post("/refresh", limitAuthRoute("refresh"), refreshSession);
authRouter.post("/logout", logout);
authRouter.get("/google", limitAuthRoute("googleStart"), startGoogleAuth);
authRouter.get(
  "/google/callback",
  limitAuthRoute("googleCallback"),
  completeGoogleAuth,
);
