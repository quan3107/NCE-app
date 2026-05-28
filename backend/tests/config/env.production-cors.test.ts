/**
 * File: tests/config/env.production-cors.test.ts
 * Purpose: Verify production CORS config requires an explicit browser origin allowlist.
 * Why: Prevents production from silently starting with credentialed CORS disabled or ambiguous.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const productionEnv = {
  NODE_ENV: "production",
  PORT: "4000",
  DATABASE_URL: "postgres://test:test@localhost:5432/nce",
  JWT_PRIVATE_KEY_PATH: "keys/private.pem",
  JWT_PUBLIC_KEY_PATH: "keys/public.pem",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  GOOGLE_REDIRECT_URI: "https://api.example.com/api/v1/auth/google/callback",
  BREVO_API_KEY: "test-brevo-api-key",
  BREVO_SENDER_NAME: "NCE App",
  BREVO_SENDER_EMAIL: "noreply@example.com",
  LOG_LEVEL: "info",
  LOG_PRETTY: "false",
} as const;

const productionCorsError =
  "CORS_ALLOWED_ORIGINS must list at least one origin in production";

describe("production CORS environment validation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...productionEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("rejects missing production CORS allowed origins", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;

    await expect(import("../../src/config/env.js")).rejects.toThrow(
      productionCorsError,
    );
  });

  it("rejects empty production CORS allowed origins", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "";

    await expect(import("../../src/config/env.js")).rejects.toThrow(
      productionCorsError,
    );
  });

  it("rejects comma-only production CORS allowed origins", async () => {
    process.env.CORS_ALLOWED_ORIGINS = " , ,, ";

    await expect(import("../../src/config/env.js")).rejects.toThrow(
      productionCorsError,
    );
  });

  it("accepts explicit production CORS allowed origins", async () => {
    process.env.CORS_ALLOWED_ORIGINS =
      "https://app.example.com,https://admin.example.com";

    const { config } = await import("../../src/config/env.js");

    expect(config.cors.allowedOrigins).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("rejects boolean production trust proxy settings", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TRUST_PROXY = "true";

    await expect(import("../../src/config/env.js")).rejects.toThrow(
      "TRUST_PROXY must list trusted proxy IPs, CIDRs, or proxy address names",
    );
  });
});
