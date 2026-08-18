/**
 * File: src/modules/auth/auth.routes.ts
 * Purpose: Register authentication HTTP routes on the Express router.
 * Why: Keeps routing definitions isolated from middleware wiring for clarity.
 */
import { Router } from "express";

import { config } from "../../config/env.js";
import {
  completeGoogleAuth,
  decideGoogleTestProvider,
  logout,
  passwordLogin,
  registerAccount,
  refreshSession,
  startGoogleAuth,
  showGoogleTestProvider,
} from "./auth.controller.js";
import { limitAuthRoute } from "./auth.rate-limit.js";

export const authRouter = Router();

authRouter.post("/login", passwordLogin);
authRouter.post("/register", limitAuthRoute("register"), registerAccount);
authRouter.post("/refresh", limitAuthRoute("refresh"), refreshSession);
authRouter.post("/logout", logout);
authRouter.get("/google", limitAuthRoute("googleStart"), startGoogleAuth);
if (config.google.testFixture.enabled) {
  authRouter.get("/google/test-provider", showGoogleTestProvider);
  authRouter.get("/google/test-provider/complete", decideGoogleTestProvider);
}
authRouter.get(
  "/google/callback",
  limitAuthRoute("googleCallback"),
  completeGoogleAuth,
);
