/**
 * File: src/modules/auth/auth.google.oauth.ts
 * Purpose: Build Google OAuth URLs and validate PKCE inputs.
 * Why: Keeps OAuth initiation logic separate from profile retrieval.
 */
import { randomBytes, createHash } from "node:crypto";

import { config } from "../../config/env.js";
import { base64UrlEncode } from "./auth.crypto.js";
import { createAuthError } from "./auth.errors.js";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_SCOPE = "openid email profile";

const PKCE_CODE_VERIFIER_MIN_LENGTH = 43;
const PKCE_CODE_VERIFIER_MAX_LENGTH = 128;

type BuildGoogleAuthorizationOptions = {
  redirectUri: string;
};

type GoogleAuthorizationBuildResult = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
};

const generateState = (): string => base64UrlEncode(randomBytes(32));

const generatePkceCodeVerifier = (): string => {
  let verifier = base64UrlEncode(randomBytes(32));
  if (verifier.length < PKCE_CODE_VERIFIER_MIN_LENGTH) {
    const additional = base64UrlEncode(randomBytes(48));
    verifier = `${verifier}${additional}`.slice(
      0,
      PKCE_CODE_VERIFIER_MIN_LENGTH,
    );
  }
  if (verifier.length > PKCE_CODE_VERIFIER_MAX_LENGTH) {
    verifier = verifier.slice(0, PKCE_CODE_VERIFIER_MAX_LENGTH);
  }
  return verifier;
};

const derivePkceCodeChallenge = (verifier: string): string => {
  const digest = createHash("sha256").update(verifier).digest();
  return base64UrlEncode(digest);
};

export function assertValidRedirectUri(
  redirectUri: string | null | undefined,
): asserts redirectUri is string {
  if (!redirectUri) {
    throw createAuthError(
      500,
      "Google redirect URI is not configured for this environment.",
    );
  }

  try {
    // Validate the URI so we fail fast if misconfigured.
    new URL(redirectUri);
  } catch {
    throw createAuthError(
      500,
      "Google redirect URI is invalid. Check the server configuration.",
    );
  }
}

export function assertValidCodeVerifier(
  codeVerifier: string | null,
): asserts codeVerifier is string {
  if (
    !codeVerifier ||
    codeVerifier.length < PKCE_CODE_VERIFIER_MIN_LENGTH ||
    codeVerifier.length > PKCE_CODE_VERIFIER_MAX_LENGTH
  ) {
    throw createAuthError(
      400,
      "Google sign-in verifier is invalid or expired. Please try again.",
    );
  }
}

export async function buildGoogleAuthorizationUrl(
  options: BuildGoogleAuthorizationOptions,
): Promise<GoogleAuthorizationBuildResult> {
  const { redirectUri } = options;

  assertValidRedirectUri(redirectUri);

  const state = generateState();
  const codeVerifier = generatePkceCodeVerifier();
  const codeChallenge = derivePkceCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return {
    authorizationUrl: `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    state,
    codeVerifier,
  };
}
