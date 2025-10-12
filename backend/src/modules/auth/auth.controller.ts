/**
 * File: src/modules/auth/auth.controller.ts
 * Purpose: Map HTTP requests to authentication service routines while returning scaffold responses.
 * Why: Provides Express-compatible handlers without exposing transport details to the services.
 */
import { type Request, type Response } from "express";

import { config } from "../../config/env.js";
import {
  REFRESH_TOKEN_TTL_MS,
  buildGoogleAuthorizationUrl,
  completeGoogleAuthorization,
  handleLogout,
  handlePasswordLogin,
  handleRegisterAccount,
  handleSessionRefresh,
} from "./auth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

const secureCookie = config.nodeEnv === "production";

const readCookie = (req: Request, name: string): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      continue;
    }
    if (rawKey === name) {
      const rawValue = rest.join("=") ?? "";
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return null;
};

const sessionContextFromRequest = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
  refreshToken: readCookie(req, REFRESH_COOKIE_NAME),
});

const setRefreshCookie = (
  res: Response,
  value: string,
): void => {
  res.cookie(REFRESH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: REFRESH_COOKIE_PATH,
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
};

export async function passwordLogin(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await handlePasswordLogin(
    req.body,
    sessionContextFromRequest(req),
  );

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function registerAccount(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await handleRegisterAccount(
    req.body,
    sessionContextFromRequest(req),
  );

  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function refreshSession(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await handleSessionRefresh(
    req.body,
    sessionContextFromRequest(req),
  );

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await handleLogout(
    req.body,
    sessionContextFromRequest(req),
  );
  clearRefreshCookie(res);
  res.status(204).send();
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
