/**
 * File: src/config/env.ts
 * Purpose: Load and validate environment variables so the backend has strongly typed configuration.
 * Why: Centralizes runtime configuration parsing to prevent scattered `process.env` access and runtime surprises.
 */
import { config as loadEnv } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  loadEnv();
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
    LOG_LEVEL: z.string().default("info"),
    LOG_PRETTY: z.enum(["true", "false"]).optional(),
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
  logLevel: parseResult.data.LOG_LEVEL,
  logPretty: shouldPrettyLog,
};

export type AppConfig = typeof envConfig;

export const config: AppConfig = envConfig;
