/**
 * File: src/modules/auth/auth.controller.ts
 * Purpose: Map HTTP requests to authentication service routines while returning scaffold responses.
 * Why: Provides Express-compatible handlers without exposing transport details to the services.
 */
import { type Request, type Response } from "express";

import {
  buildGoogleAuthorizationUrl,
  completeGoogleAuthorization,
  handleLogout,
  handlePasswordLogin,
  handleSessionRefresh,
} from "./auth.service.js";

export async function passwordLogin(
  req: Request,
  res: Response,
): Promise<void> {
  await handlePasswordLogin(req.body);
  res
    .status(501)
    .json({ message: "Password login flow not implemented yet." });
}

export async function refreshSession(
  req: Request,
  res: Response,
): Promise<void> {
  await handleSessionRefresh(req.body);
  res
    .status(501)
    .json({ message: "Session refresh flow not implemented yet." });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  await handleLogout();
  res.status(501).json({ message: "Logout flow not implemented yet." });
}

export async function startGoogleAuth(
  _req: Request,
  res: Response,
): Promise<void> {
  await buildGoogleAuthorizationUrl();
  res
    .status(501)
    .json({ message: "Google auth initiation not implemented yet." });
}

export async function completeGoogleAuth(
  req: Request,
  res: Response,
): Promise<void> {
  await completeGoogleAuthorization(req.query);
  res
    .status(501)
    .json({ message: "Google auth callback handling not implemented yet." });
}
