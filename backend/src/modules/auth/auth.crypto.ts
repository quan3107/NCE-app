/**
 * File: src/modules/auth/auth.crypto.ts
 * Purpose: Provide small cryptographic helpers for auth workflows.
 * Why: Centralizes hashing and constant-time comparisons used across modules.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const base64UrlEncode = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");

export const timingSafeMatch = (first: string, second: string): boolean => {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }
  return timingSafeEqual(firstBuffer, secondBuffer);
};

export const hashValue = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const generateRefreshToken = (): string =>
  randomBytes(48).toString("base64url");
