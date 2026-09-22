/**
 * File: src/modules/auth/auth.routes.ts
 * Purpose: Register authentication HTTP routes on the Express router.
 * Why: Keeps routing definitions isolated from middleware wiring for clarity.
 */
import { Router } from "express";
import {
  inspectGoogleLink,
  linkGoogleAccount,
  declineGoogleLink,
} from "./auth.google.link.controller.js";

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
import {
  requestPasswordReset,
  resetPassword,
  PASSWORD_RESET_REQUEST_MESSAGE,
} from "./auth.recovery.js";

export const authRouter = Router();
authRouter.get("/google/link", limitAuthRoute("googleCallback"), inspectGoogleLink);
authRouter.post("/google/link", limitAuthRoute("googleCallback"), linkGoogleAccount);
authRouter.post(
  "/google/link/cancel",
  limitAuthRoute("googleCallback"),
  declineGoogleLink,
);

authRouter.post(
  "/forgot-password",
  limitAuthRoute("requestPasswordReset"),
  async (req, res) => {
    await requestPasswordReset(req.body);
    res.set("Cache-Control", "no-store").status(200).json({
      message: PASSWORD_RESET_REQUEST_MESSAGE,
    });
  },
);
authRouter.post(
  "/reset-password",
  limitAuthRoute("resetPassword"),
  async (req, res) => {
    await resetPassword(req.body);
    res.set("Cache-Control", "no-store").status(200).json({
      message: "Password reset. Sign in with your new password.",
    });
  },
);

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
