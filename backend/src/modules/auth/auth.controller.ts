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
  handleRegisterAccount,
  handleSessionRefresh,
} from "./auth.service.js";
import {
  appendReturnStatus,
  clearGoogleCookie,
  clearGoogleOAuthCookies,
  clearRefreshCookie,
  getShortErrorMessage,
  GOOGLE_RETURN_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
  GOOGLE_VERIFIER_COOKIE_NAME,
  readCookie,
  resolveGoogleRedirectUri,
  sanitizeReturnTo,
  sessionContextFromRequest,
  setGoogleCookie,
  setRefreshCookie,
} from "./auth.cookies.js";
import type {
  PendingApprovalResult,
  RegisterAccountResult,
} from "./auth.types.js";

function isPendingApprovalResult(
  result: RegisterAccountResult,
): result is PendingApprovalResult {
  return "status" in result && result.status === "pending_approval";
}

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

  if (isPendingApprovalResult(result)) {
    clearRefreshCookie(res);
    res.status(202).json({
      status: result.status,
      user: result.user,
      message: "Account is pending administrator approval.",
    });
    return;
  }

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
      const destination = appendReturnStatus(
        resolvedReturnTo,
        "error",
        getShortErrorMessage(error),
      );
      res.redirect(303, destination);
      return;
    }

    throw error;
  }
}
