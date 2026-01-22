/**
 * File: src/modules/auth/auth.google.profile.ts
 * Purpose: Exchange Google auth codes for profile data.
 * Why: Separates token exchange and profile normalization from controller logic.
 */
import { config } from "../../config/env.js";
import { createAuthError } from "./auth.errors.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_ALLOWED_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
  refresh_token?: string;
};

type GoogleIdTokenPayload = {
  iss: string;
  aud: string | string[];
  sub: string;
  email?: string;
  email_verified?: boolean;
  at_hash?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export type GoogleProfile = {
  providerSubject: string;
  providerIssuer: string;
  normalizedEmail: string;
  emailVerified: boolean;
  fullName: string;
};

const decodeIdToken = (idToken: string): GoogleIdTokenPayload => {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw createAuthError(401, "Google sign-in returned an invalid token.");
  }

  try {
    const payloadSegment = parts[1] ?? "";
    const payloadJson = Buffer.from(payloadSegment, "base64url").toString(
      "utf8",
    );
    const payload = JSON.parse(payloadJson) as GoogleIdTokenPayload;
    return payload;
  } catch {
    throw createAuthError(401, "Unable to read Google identity token.");
  }
};

const exchangeAuthorizationCode = async (params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> => {
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: params.code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: "authorization_code",
        code_verifier: params.codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    return (await tokenResponse.json()) as GoogleTokenResponse;
  } catch {
    throw createAuthError(
      401,
      "Unable to complete Google sign-in. Please try again.",
    );
  }
};

const fetchGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  try {
    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(
        `userinfo request failed: ${userInfoResponse.statusText}`,
      );
    }

    return (await userInfoResponse.json()) as GoogleUserInfo;
  } catch {
    throw createAuthError(
      401,
      "Unable to read Google account profile information.",
    );
  }
};

export async function fetchGoogleProfile(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleProfile> {
  const tokenPayload = await exchangeAuthorizationCode(params);

  if (
    !tokenPayload.access_token ||
    tokenPayload.token_type !== "Bearer" ||
    !tokenPayload.id_token
  ) {
    throw createAuthError(
      401,
      "Google did not return the expected tokens. Please try again.",
    );
  }

  const idToken = decodeIdToken(tokenPayload.id_token);
  const audience = Array.isArray(idToken.aud) ? idToken.aud : [idToken.aud];
  if (!audience.includes(config.google.clientId)) {
    throw createAuthError(
      401,
      "Google identity token audience mismatch detected.",
    );
  }

  if (!GOOGLE_ALLOWED_ISSUERS.has(idToken.iss)) {
    throw createAuthError(401, "Google identity token issuer is not trusted.");
  }

  const profile = await fetchGoogleUserInfo(tokenPayload.access_token);

  if (profile.sub !== idToken.sub) {
    throw createAuthError(
      401,
      "Google identity token does not match profile information.",
    );
  }

  const normalizedEmail = (profile.email ?? idToken.email)?.toLowerCase();
  if (!normalizedEmail) {
    throw createAuthError(
      400,
      "Google account is missing an email address. Update your Google profile and try again.",
    );
  }

  const emailVerified =
    profile.email_verified === true || idToken.email_verified === true;
  if (!emailVerified) {
    throw createAuthError(
      400,
      "Google account email must be verified before signing in.",
    );
  }

  const deriveFullName = (): string => {
    const fromProfile = profile.name?.trim();
    if (fromProfile && fromProfile.length > 0) {
      return fromProfile;
    }
    const combined = `${profile.given_name ?? ""} ${
      profile.family_name ?? ""
    }`.trim();
    if (combined.length > 0) {
      return combined;
    }
    const [localPart] = normalizedEmail.split("@");
    return localPart ?? normalizedEmail;
  };

  return {
    providerSubject: profile.sub,
    providerIssuer: idToken.iss ?? "https://accounts.google.com",
    normalizedEmail,
    emailVerified,
    fullName: deriveFullName(),
  };
}
