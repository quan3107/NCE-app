/**
 * File: src/config/env.ts
 * Purpose: Load and validate environment variables so the backend has strongly typed configuration.
 * Why: Centralizes runtime configuration parsing to prevent scattered `process.env` access and runtime surprises.
 */
import { isIP } from "node:net";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  loadEnv({ quiet: process.env.NODE_ENV === "test" });
}

const defaultCorsAllowedOrigins =
  process.env.NODE_ENV === "production"
    ? ""
    : "http://localhost:5173,http://127.0.0.1:5173";

const defaultAuthRateLimit =
  process.env.NODE_ENV === "test"
    ? {
        passwordLoginMaxFailures: 3,
        passwordLoginWindowMs: 60_000,
        passwordLoginLockoutMs: 60_000,
        ipMaxAttempts: 3,
        ipWindowMs: 60_000,
        maxTrackedKeys: 100,
      }
    : {
        passwordLoginMaxFailures: 5,
        passwordLoginWindowMs: 15 * 60_000,
        passwordLoginLockoutMs: 15 * 60_000,
        ipMaxAttempts: 30,
        ipWindowMs: 60_000,
        maxTrackedKeys: 50_000,
      };

const defaultTrustProxy =
  process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test"
    ? "loopback"
    : "";
const defaultNceAssetRoot = "storage/nce-assets";

const trustedProxyAddressNames = new Set(["loopback", "linklocal", "uniquelocal"]);
const trustProxyErrorMessage =
  "TRUST_PROXY must list trusted proxy IPs, CIDRs, or proxy address names";
const aiReasoningEffortSchema = z.enum(["none", "low", "medium", "high", "xhigh"]);
const aiProviderSchema = z.enum(["openai-compatible"]);
function booleanStringWithDefault(defaultValue: "true" | "false") {
  return z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");
}
const optionalSecretSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

function parseCorsAllowedOrigins(value: string, context: z.RefinementCtx): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin) {
        context.addIssue({
          code: "custom",
          message: `${origin} must not include a path, query, or hash`,
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: `${origin} must be a valid URL origin`,
      });
    }
  }

  return origins;
}

function parseTrustProxy(value: string, context: z.RefinementCtx): string[] {
  const trustedProxies = value
    .split(",")
    .map((proxy) => proxy.trim())
    .filter((proxy) => proxy.length > 0);

  for (const trustedProxy of trustedProxies) {
    if (trustedProxy === "true" || trustedProxy === "false") {
      context.addIssue({
        code: "custom",
        message: trustProxyErrorMessage,
      });
      continue;
    }

    if (trustedProxyAddressNames.has(trustedProxy)) {
      continue;
    }

    const slashIndex = trustedProxy.lastIndexOf("/");
    const address =
      slashIndex === -1 ? trustedProxy : trustedProxy.slice(0, slashIndex);
    const rawPrefix =
      slashIndex === -1 ? null : trustedProxy.slice(slashIndex + 1);
    const prefix = rawPrefix === null ? null : Number(rawPrefix);
    const ipVersion = isIP(address);

    const validPrefix =
      prefix === null ||
      (rawPrefix !== "" &&
        Number.isInteger(prefix) &&
        prefix > 0 &&
        ((ipVersion === 4 && prefix <= 32) || (ipVersion === 6 && prefix <= 128)));

    if (ipVersion === 0 || !validPrefix) {
      context.addIssue({
        code: "custom",
        message: trustProxyErrorMessage,
      });
    }
  }

  return trustedProxies;
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_PRIVATE_KEY_PATH: z
      .string()
      .min(1, "JWT_PRIVATE_KEY_PATH is required"),
    JWT_PUBLIC_KEY_PATH: z.string().min(1, "JWT_PUBLIC_KEY_PATH is required"),
    GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
    BREVO_API_KEY: z.string().min(1, "BREVO_API_KEY is required"),
    BREVO_SENDER_NAME: z.string().min(1, "BREVO_SENDER_NAME is required"),
    BREVO_SENDER_EMAIL: z
      .string()
      .min(1, "BREVO_SENDER_EMAIL is required")
      .email("BREVO_SENDER_EMAIL must be a valid email"),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default(defaultCorsAllowedOrigins)
      .transform(parseCorsAllowedOrigins),
    AUTH_PASSWORD_LOGIN_MAX_FAILURES: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.passwordLoginMaxFailures),
    AUTH_PASSWORD_LOGIN_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.passwordLoginWindowMs),
    AUTH_PASSWORD_LOGIN_LOCKOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.passwordLoginLockoutMs),
    AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.ipMaxAttempts),
    AUTH_IP_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.ipWindowMs),
    AUTH_RATE_LIMIT_MAX_TRACKED_KEYS: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultAuthRateLimit.maxTrackedKeys),
    TRUST_PROXY: z.string().default(defaultTrustProxy).transform(parseTrustProxy),
    LOG_LEVEL: z.string().default("info"),
    LOG_PRETTY: z.enum(["true", "false"]).optional(),
    NCE_ASSET_ROOT: z.string().trim().min(1).default(defaultNceAssetRoot),
    AI_FEEDBACK_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AI_PROVIDER: aiProviderSchema.default("openai-compatible"),
    AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    AI_API_KEY: optionalSecretSchema,
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(12_000),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1_200),
    AI_HEALTH_PATH: z.string().trim().default("/models"),
    AI_LOW_COST_MODEL: z.string().trim().min(1).default("gpt-5.4-nano"),
    AI_LOW_COST_REASONING_EFFORT: aiReasoningEffortSchema.default("medium"),
    AI_LOW_COST_SUPPORTS_IMAGE_INPUT: booleanStringWithDefault("false"),
    AI_PREMIUM_MODEL: z.string().trim().min(1).default("gpt-5.4-mini"),
    AI_PREMIUM_REASONING_EFFORT: aiReasoningEffortSchema.default("high"),
    AI_PREMIUM_SUPPORTS_IMAGE_INPUT: booleanStringWithDefault("true"),
    AI_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
    AI_IMAGE_SUPPORTED_MIME_TYPES: z
      .string()
      .default("image/png,image/jpeg,image/webp,image/gif")
      .transform((value) =>
        value
          .split(",")
          .map((mime) => mime.trim().toLowerCase())
          .filter((mime) => mime.length > 0),
      ),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.CORS_ALLOWED_ORIGINS.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ALLOWED_ORIGINS"],
        message: "CORS_ALLOWED_ORIGINS must list at least one origin in production",
      });
    }
    if (
      env.NODE_ENV === "production" &&
      typeof process.env.NCE_ASSET_ROOT !== "string"
    ) {
      context.addIssue({
        code: "custom",
        path: ["NCE_ASSET_ROOT"],
        message: "NCE_ASSET_ROOT is required in production",
      });
    }
  });

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const formattedErrors = parseResult.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration - ${formattedErrors}`);
}

const shouldPrettyLog =
  parseResult.data.LOG_PRETTY === undefined
    ? parseResult.data.NODE_ENV !== "production"
    : parseResult.data.LOG_PRETTY === "true";

const envConfig = {
  nodeEnv: parseResult.data.NODE_ENV,
  port: parseResult.data.PORT,
  databaseUrl: parseResult.data.DATABASE_URL,
  jwt: {
    privateKeyPath: parseResult.data.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: parseResult.data.JWT_PUBLIC_KEY_PATH,
  },
  google: {
    clientId: parseResult.data.GOOGLE_CLIENT_ID,
    clientSecret: parseResult.data.GOOGLE_CLIENT_SECRET,
    redirectUri: parseResult.data.GOOGLE_REDIRECT_URI,
  },
  email: {
    brevoApiKey: parseResult.data.BREVO_API_KEY,
    senderName: parseResult.data.BREVO_SENDER_NAME,
    senderEmail: parseResult.data.BREVO_SENDER_EMAIL,
  },
  cors: {
    allowedOrigins: parseResult.data.CORS_ALLOWED_ORIGINS,
  },
  authRateLimit: {
    passwordLogin: {
      maxFailures: parseResult.data.AUTH_PASSWORD_LOGIN_MAX_FAILURES,
      windowMs: parseResult.data.AUTH_PASSWORD_LOGIN_WINDOW_MS,
      lockoutMs: parseResult.data.AUTH_PASSWORD_LOGIN_LOCKOUT_MS,
    },
    ipAttempts: {
      maxAttempts: parseResult.data.AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: parseResult.data.AUTH_IP_RATE_LIMIT_WINDOW_MS,
    },
    maxTrackedKeys: parseResult.data.AUTH_RATE_LIMIT_MAX_TRACKED_KEYS,
  },
  trustProxy: parseResult.data.TRUST_PROXY,
  logLevel: parseResult.data.LOG_LEVEL,
  logPretty: shouldPrettyLog,
  nceAssets: {
    root: parseResult.data.NCE_ASSET_ROOT,
  },
  aiFeedback: {
    enabled: parseResult.data.AI_FEEDBACK_ENABLED,
    provider: parseResult.data.AI_PROVIDER,
    baseUrl: parseResult.data.AI_BASE_URL,
    apiKey: parseResult.data.AI_API_KEY,
    timeoutMs: parseResult.data.AI_TIMEOUT_MS,
    maxInputChars: parseResult.data.AI_MAX_INPUT_CHARS,
    maxOutputTokens: parseResult.data.AI_MAX_OUTPUT_TOKENS,
    imageInput: {
      maxBytes: parseResult.data.AI_IMAGE_MAX_BYTES,
      supportedMimeTypes: parseResult.data.AI_IMAGE_SUPPORTED_MIME_TYPES,
    },
    healthPath: parseResult.data.AI_HEALTH_PATH,
    routes: {
      lowCost: {
        model: parseResult.data.AI_LOW_COST_MODEL,
        reasoningEffort: parseResult.data.AI_LOW_COST_REASONING_EFFORT,
        supportsImageInput: parseResult.data.AI_LOW_COST_SUPPORTS_IMAGE_INPUT,
      },
      premium: {
        model: parseResult.data.AI_PREMIUM_MODEL,
        reasoningEffort: parseResult.data.AI_PREMIUM_REASONING_EFFORT,
        supportsImageInput: parseResult.data.AI_PREMIUM_SUPPORTS_IMAGE_INPUT,
      },
    },
  },
};

export type AppConfig = typeof envConfig;
export type AiFeedbackConfig = AppConfig["aiFeedback"];
export type AiReasoningEffort = AiFeedbackConfig["routes"]["lowCost"]["reasoningEffort"];

export const config: AppConfig = envConfig;
