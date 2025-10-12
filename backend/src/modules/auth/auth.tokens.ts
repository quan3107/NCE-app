/**
 * File: src/modules/auth/auth.tokens.ts
 * Purpose: Provide helpers for signing and verifying JWT access tokens with the configured RSA keys.
 * Why: Keeps key loading and token handling centralized so other auth modules stay focused on business logic.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";

import jwt from "jsonwebtoken";

import { config } from "../../config/env.js";

type AccessTokenClaims = {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
};

const TOKEN_ISSUER = "nce-api";
const TOKEN_AUDIENCE = "nce-app";
const ACCESS_TOKEN_TTL = "15m";

// Keep shared key material at module scope so token helpers stay cheap to call.
const { privateKey, publicKey } = loadJwtKeys();

export function signAccessToken(payload: {
  userId: string;
  role: string;
}): string {
  return jwt.sign(
    { role: payload.role },
    privateKey,
    {
      algorithm: "RS256",
      expiresIn: ACCESS_TOKEN_TTL,
      subject: payload.userId,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  }) as AccessTokenClaims;
}

function loadJwtKeys(): { privateKey: string; publicKey: string } {
  const resolvedPrivatePath = resolve(process.cwd(), config.jwt.privateKeyPath);
  const resolvedPublicPath = resolve(process.cwd(), config.jwt.publicKeyPath);

  if (existsSync(resolvedPrivatePath) && existsSync(resolvedPublicPath)) {
    return {
      privateKey: readFileSync(resolvedPrivatePath, "utf-8"),
      publicKey: readFileSync(resolvedPublicPath, "utf-8"),
    };
  }

  const inlinePrivate = process.env.JWT_PRIVATE_KEY;
  const inlinePublic = process.env.JWT_PUBLIC_KEY;

  if (inlinePrivate && inlinePublic) {
    return {
      privateKey: normalizeInlineKey(inlinePrivate),
      publicKey: normalizeInlineKey(inlinePublic),
    };
  }

  if (config.nodeEnv !== "production") {
    const generatedKeys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    return {
      privateKey: generatedKeys.privateKey,
      publicKey: generatedKeys.publicKey,
    };
  }

  throw new Error(
    [
      "JWT key material is missing.",
      `Expected RSA files at ${resolvedPrivatePath} and ${resolvedPublicPath}`,
      "or environment variables JWT_PRIVATE_KEY and JWT_PUBLIC_KEY.",
    ].join(" "),
  );
}

function normalizeInlineKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}
