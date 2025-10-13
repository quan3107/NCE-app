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
const GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 5; // 5 minutes
const GOOGLE_STATE_COOKIE_NAME = "googleOAuthState";
const GOOGLE_VERIFIER_COOKIE_NAME = "googleOAuthVerifier";
const GOOGLE_OAUTH_COOKIE_PATH = `${REFRESH_COOKIE_PATH}/google`;

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

const setGoogleCookie = (res: Response, name: string, value: string): void => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
    path: GOOGLE_OAUTH_COOKIE_PATH,
  });
};

const clearGoogleCookie = (res: Response, name: string): void => {
  res.clearCookie(name, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: GOOGLE_OAUTH_COOKIE_PATH,
  });
};

const clearGoogleOAuthCookies = (res: Response): void => {
  clearGoogleCookie(res, GOOGLE_STATE_COOKIE_NAME);
  clearGoogleCookie(res, GOOGLE_VERIFIER_COOKIE_NAME);
};

const resolveGoogleRedirectUri = (req: Request): string | null => {
  const host = req.get("host");
  if (!host) {
    return null;
  }
  return `${req.protocol}://${host}${REFRESH_COOKIE_PATH}/google/callback`;
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
  req: Request,
  res: Response,
): Promise<void> {
  const redirectUri = resolveGoogleRedirectUri(req);
  if (!redirectUri) {
    res
      .status(500)
      .json({ message: "Unable to determine callback URL for Google sign-in." });
    return;
  }

  const { authorizationUrl, state, codeVerifier } =
    await buildGoogleAuthorizationUrl({ redirectUri });

  setGoogleCookie(res, GOOGLE_STATE_COOKIE_NAME, state);
  setGoogleCookie(res, GOOGLE_VERIFIER_COOKIE_NAME, codeVerifier);

  res.status(200).json({
    authorizationUrl,
  });
}

export async function completeGoogleAuth(
  req: Request,
  res: Response,
): Promise<void> {
  const redirectUri = resolveGoogleRedirectUri(req);
  if (!redirectUri) {
    res
      .status(500)
      .json({ message: "Unable to determine callback URL for Google sign-in." });
    return;
  }

  const result = await completeGoogleAuthorization(req.query, {
    redirectUri,
    expectedState: readCookie(req, GOOGLE_STATE_COOKIE_NAME),
    codeVerifier: readCookie(req, GOOGLE_VERIFIER_COOKIE_NAME),
    context: sessionContextFromRequest(req),
  });

  clearGoogleOAuthCookies(res);
  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    user: result.user,
    accessToken: result.accessToken,
  });
}
