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
const REFRESH_COOKIE_LEGACY_PATH = "/";

const secureCookie = config.nodeEnv === "production";
const GOOGLE_OAUTH_COOKIE_MAX_AGE_MS = 1000 * 60 * 5; // 5 minutes
const GOOGLE_STATE_COOKIE_NAME = "googleOAuthState";
const GOOGLE_VERIFIER_COOKIE_NAME = "googleOAuthVerifier";
const GOOGLE_RETURN_COOKIE_NAME = "googleOAuthReturnTo";
const GOOGLE_OAUTH_COOKIE_PATH = `${REFRESH_COOKIE_PATH}/google`;

const readCookie = (req: Request, name: string): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";");
  const matches: string[] = [];
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      continue;
    }
    if (rawKey === name) {
      matches.push(rest.join("=") ?? "");
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Prefer the most recently serialized cookie when duplicate names exist.
  // This helps recover from old refreshToken cookies left on legacy paths.
  const rawValue = matches[matches.length - 1] ?? "";
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
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
  // Clear historical root-path cookie variants before setting the scoped cookie.
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

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: REFRESH_COOKIE_LEGACY_PATH,
  });

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

const sanitizeReturnTo = (raw: unknown, origin: string | null): string | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length > 512) {
    return null;
  }

  try {
    const baseUrl = origin ?? undefined;
    const candidate = baseUrl
      ? new URL(trimmed, baseUrl)
      : new URL(trimmed);

    if (origin) {
      const originUrl = new URL(origin);
      if (candidate.origin !== originUrl.origin) {
        return null;
      }
    }

    return candidate.toString();
  } catch {
    return null;
  }
};

const appendReturnStatus = (
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

const resolveGoogleRedirectUri = (req: Request): string | null => {
  if (config.google.redirectUri) {
    return config.google.redirectUri;
  }

  const forwardedHostHeader = req.get("x-forwarded-host");
  const forwardedHost = forwardedHostHeader
    ? forwardedHostHeader.split(",")[0]?.trim()
    : null;
  const host = req.get("host");
  const resolvedHost = forwardedHost && forwardedHost.length > 0 ? forwardedHost : host;
  if (!resolvedHost) {
    return null;
  }

  const forwardedProtoHeader = req.get("x-forwarded-proto");
  const forwardedProto = forwardedProtoHeader
    ? forwardedProtoHeader.split(",")[0]?.trim()
    : null;
  const protocol = forwardedProto && forwardedProto.length > 0 ? forwardedProto : req.protocol;

  return `${protocol}://${resolvedHost}${REFRESH_COOKIE_PATH}/google/callback`;
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

  const origin = req.get("origin") ?? null;
  const rawReturnTo = Array.isArray(req.query.returnTo)
    ? req.query.returnTo[0]
    : req.query.returnTo;
  const resolvedReturnTo = sanitizeReturnTo(rawReturnTo, origin);
  if (rawReturnTo && !resolvedReturnTo) {
    res
      .status(400)
      .json({ message: "Requested Google return path is not allowed." });
    return;
  }

  setGoogleCookie(res, GOOGLE_STATE_COOKIE_NAME, state);
  setGoogleCookie(res, GOOGLE_VERIFIER_COOKIE_NAME, codeVerifier);
  if (resolvedReturnTo) {
    setGoogleCookie(res, GOOGLE_RETURN_COOKIE_NAME, resolvedReturnTo);
  } else {
    clearGoogleCookie(res, GOOGLE_RETURN_COOKIE_NAME);
  }

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

  const origin = req.get("origin") ?? null;
  const rawReturnTo = readCookie(req, GOOGLE_RETURN_COOKIE_NAME);
  const resolvedReturnTo = sanitizeReturnTo(rawReturnTo, origin);

  try {
    const result = await completeGoogleAuthorization(req.query, {
      redirectUri,
      expectedState: readCookie(req, GOOGLE_STATE_COOKIE_NAME),
      codeVerifier: readCookie(req, GOOGLE_VERIFIER_COOKIE_NAME),
      context: sessionContextFromRequest(req),
    });

    clearGoogleOAuthCookies(res);
    clearGoogleCookie(res, GOOGLE_RETURN_COOKIE_NAME);
    setRefreshCookie(res, result.refreshToken);

    if (resolvedReturnTo) {
      const destination = appendReturnStatus(resolvedReturnTo, "success");
      res.redirect(303, destination);
      return;
    }

    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    clearGoogleOAuthCookies(res);
    clearGoogleCookie(res, GOOGLE_RETURN_COOKIE_NAME);

    if (resolvedReturnTo) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? ((error as { message: string }).message.length > 160
              ? (error as { message: string }).message.slice(0, 157) + "..."
              : (error as { message: string }).message)
          : "Google sign-in failed.";

      const destination = appendReturnStatus(
        resolvedReturnTo,
        "error",
        message,
      );
      res.redirect(303, destination);
      return;
    }

    throw error;
  }
}
