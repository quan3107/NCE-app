/**
 * File: src/modules/auth/auth.tokens.ts
 * Purpose: Provide helpers for signing and verifying JWT access tokens with the configured RSA keys.
 * Why: Keeps key loading and token handling centralized so other auth modules stay focused on business logic.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const privateKey = readFileSync(
  resolve(process.cwd(), config.jwt.privateKeyPath),
  "utf-8",
);
const publicKey = readFileSync(
  resolve(process.cwd(), config.jwt.publicKeyPath),
  "utf-8",
);

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

