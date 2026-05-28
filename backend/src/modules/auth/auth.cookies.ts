/**
 * File: src/modules/auth/auth.cookies.ts
 * Purpose: Own auth controller cookie and Google OAuth redirect helpers.
 * Why: Keeps HTTP handler functions small while preserving cookie behavior in one place.
 */
import { type Request, type Response } from "express";

import { config } from "../../config/env.js";
import { REFRESH_TOKEN_TTL_MS } from "./auth.service.js";

const REFRESH_COOKIE_LEGACY_PATH = "/";
const secureCookie = config.nodeEnv === "production";

export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 5;
export const GOOGLE_STATE_COOKIE_NAME = "googleOAuthState";
export const GOOGLE_VERIFIER_COOKIE_NAME = "googleOAuthVerifier";
export const GOOGLE_RETURN_COOKIE_NAME = "googleOAuthReturnTo";
export const GOOGLE_OAUTH_COOKIE_PATH = `${REFRESH_COOKIE_PATH}/google`;

export const readCookie = (req: Request, name: string): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const matches = cookieHeader
    .split(";")
    .map((pair) => pair.trim().split("="))
    .filter(([rawKey]) => rawKey === name)
    .map(([, ...rest]) => rest.join("=") ?? "");

  if (matches.length === 0) {
    return null;
  }

  const rawValue = matches[0] ?? "";
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
};

export const sessionContextFromRequest = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
  refreshToken: readCookie(req, REFRESH_COOKIE_NAME),
});

export const setRefreshCookie = (res: Response, value: string): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: REFRESH_COOKIE_LEGACY_PATH,
  });

  res.cookie(REFRESH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: REFRESH_COOKIE_PATH,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  [REFRESH_COOKIE_LEGACY_PATH, REFRESH_COOKIE_PATH].forEach((path) => {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path,
    });
  });
};

export const setGoogleCookie = (
  res: Response,
  name: string,
  value: string,
): void => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_MS,
    path: GOOGLE_OAUTH_COOKIE_PATH,
  });
};

export const clearGoogleCookie = (res: Response, name: string): void => {
  res.clearCookie(name, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: GOOGLE_OAUTH_COOKIE_PATH,
  });
};

export const clearGoogleOAuthCookies = (res: Response): void => {
  clearGoogleCookie(res, GOOGLE_STATE_COOKIE_NAME);
  clearGoogleCookie(res, GOOGLE_VERIFIER_COOKIE_NAME);
};

export const sanitizeReturnTo = (
  raw: unknown,
  origin: string | null,
): string | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length > 512) {
    return null;
  }

  try {
    const candidate = origin ? new URL(trimmed, origin) : new URL(trimmed);
    if (origin && candidate.origin !== new URL(origin).origin) {
      return null;
    }
    return candidate.toString();
  } catch {
    return null;
  }
};

export const appendReturnStatus = (
  target: string,
  status: "success" | "error",
  message?: string,
): string => {
  try {
    const url = new URL(target);
    url.searchParams.set("googleAuth", status);
    if (status === "error" && message) {
      url.searchParams.set("googleAuthMessage", message);
    } else {
      url.searchParams.delete("googleAuthMessage");
    }
    return url.toString();
  } catch {
    return target;
  }
};

export const resolveGoogleRedirectUri = (req: Request): string | null => {
  if (config.google.redirectUri) {
    return config.google.redirectUri;
  }

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req.get("host");
  const resolvedHost = forwardedHost && forwardedHost.length > 0 ? forwardedHost : host;
  if (!resolvedHost) {
    return null;
  }

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto && forwardedProto.length > 0 ? forwardedProto : req.protocol;

  return `${protocol}://${resolvedHost}${REFRESH_COOKIE_PATH}/google/callback`;
};

export const getShortErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message;
    return message.length > 160 ? `${message.slice(0, 157)}...` : message;
  }

  return "Google sign-in failed.";
};
