/**
 * File: tests/config/env.test.ts
 * Purpose: Verify backend tests receive deterministic environment defaults.
 * Why: Keeps test collection independent from developer .env files and provider secrets.
 */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from '../../src/config/env.js'
import { applyBackendTestEnvDefaults } from '../setup/testEnvDefaults.js'

const defaultedEnvKeys = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_PRIVATE_KEY_PATH',
  'JWT_PUBLIC_KEY_PATH',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'BREVO_API_KEY',
  'BREVO_SENDER_NAME',
  'BREVO_SENDER_EMAIL',
  'CORS_ALLOWED_ORIGINS',
  'AUTH_PASSWORD_LOGIN_MAX_FAILURES',
  'AUTH_PASSWORD_LOGIN_WINDOW_MS',
  'AUTH_PASSWORD_LOGIN_LOCKOUT_MS',
  'AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS',
  'AUTH_IP_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX_TRACKED_KEYS',
  'CLEANUP_AUTH_SESSION_RETENTION_DAYS',
  'CLEANUP_NOTIFICATION_METADATA_RETENTION_DAYS',
  'TRUST_PROXY',
  'LOG_LEVEL',
  'LOG_PRETTY',
  'NCE_ASSET_ROOT',
  'AI_FEEDBACK_ENABLED',
  'AI_PROVIDER',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_TIMEOUT_MS',
  'AI_MAX_INPUT_CHARS',
  'AI_MAX_OUTPUT_TOKENS',
  'AI_HEALTH_PATH',
  'AI_LOW_COST_MODEL',
  'AI_LOW_COST_REASONING_EFFORT',
  'AI_LOW_COST_SUPPORTS_IMAGE_INPUT',
  'AI_PREMIUM_MODEL',
  'AI_PREMIUM_REASONING_EFFORT',
  'AI_PREMIUM_SUPPORTS_IMAGE_INPUT',
  'AI_IMAGE_MAX_BYTES',
  'AI_IMAGE_SUPPORTED_MIME_TYPES',
] as const

describe('test environment defaults', () => {
  it('fills missing test-only defaults before runtime config is imported', () => {
    const originalValues = new Map<string, string | undefined>(
      defaultedEnvKeys.map((key) => [key, process.env[key]]),
    )

    try {
      for (const key of defaultedEnvKeys) {
        delete process.env[key]
      }

      applyBackendTestEnvDefaults()

      expect(process.env.DATABASE_URL).toBe(
        'postgres://test_user:test_password@localhost:5432/nce_test',
      )
      expect(process.env.DIRECT_URL).toBe(process.env.DATABASE_URL)
      expect(process.env.JWT_PRIVATE_KEY_PATH).toBe(
        'tests/runtime/generated-jwt-private.pem',
      )
      expect(process.env.JWT_PUBLIC_KEY_PATH).toBe(
        'tests/runtime/generated-jwt-public.pem',
      )
      expect(process.env.GOOGLE_CLIENT_ID).toBe('test-google-client-id')
      expect(process.env.GOOGLE_CLIENT_SECRET).toBe('test-google-client-secret')
      expect(process.env.GOOGLE_REDIRECT_URI).toBe(
        'http://localhost:4000/api/v1/auth/google/callback',
      )
      expect(process.env.BREVO_API_KEY).toBe('test-brevo-api-key')
      expect(process.env.BREVO_SENDER_NAME).toBe('NCE Test Mailer')
      expect(process.env.BREVO_SENDER_EMAIL).toBe('noreply.test@example.com')
      expect(process.env.CORS_ALLOWED_ORIGINS).toBe(
        'http://localhost:5173,http://127.0.0.1:5173',
      )
      expect(process.env.AUTH_PASSWORD_LOGIN_MAX_FAILURES).toBe('3')
      expect(process.env.AUTH_PASSWORD_LOGIN_WINDOW_MS).toBe('60000')
      expect(process.env.AUTH_PASSWORD_LOGIN_LOCKOUT_MS).toBe('60000')
      expect(process.env.AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS).toBe('3')
      expect(process.env.AUTH_IP_RATE_LIMIT_WINDOW_MS).toBe('60000')
      expect(process.env.AUTH_RATE_LIMIT_MAX_TRACKED_KEYS).toBe('100')
      expect(process.env.CLEANUP_AUTH_SESSION_RETENTION_DAYS).toBe('30')
      expect(process.env.CLEANUP_NOTIFICATION_METADATA_RETENTION_DAYS).toBe('90')
      expect(process.env.TRUST_PROXY).toBe('loopback')
      expect(process.env.LOG_LEVEL).toBe('silent')
      expect(process.env.LOG_PRETTY).toBe('false')
      expect(process.env.NCE_ASSET_ROOT).toBe('tests/fixtures/nce-assets')
      expect(process.env.AI_FEEDBACK_ENABLED).toBe('false')
      expect(process.env.AI_PROVIDER).toBe('openai-compatible')
      expect(process.env.AI_BASE_URL).toBe('https://api.openai.com/v1')
      expect(process.env.AI_API_KEY).toBe('')
      expect(process.env.AI_TIMEOUT_MS).toBe('10000')
      expect(process.env.AI_MAX_INPUT_CHARS).toBe('12000')
      expect(process.env.AI_MAX_OUTPUT_TOKENS).toBe('1200')
      expect(process.env.AI_HEALTH_PATH).toBe('/models')
      expect(process.env.AI_LOW_COST_MODEL).toBe('gpt-5.4-nano')
      expect(process.env.AI_LOW_COST_REASONING_EFFORT).toBe('medium')
      expect(process.env.AI_LOW_COST_SUPPORTS_IMAGE_INPUT).toBe('false')
      expect(process.env.AI_PREMIUM_MODEL).toBe('gpt-5.4-mini')
      expect(process.env.AI_PREMIUM_REASONING_EFFORT).toBe('high')
      expect(process.env.AI_PREMIUM_SUPPORTS_IMAGE_INPUT).toBe('true')
      expect(process.env.AI_IMAGE_MAX_BYTES).toBe('20971520')
      expect(process.env.AI_IMAGE_SUPPORTED_MIME_TYPES).toBe(
        'image/png,image/jpeg,image/webp,image/gif',
      )
    } finally {
      for (const key of defaultedEnvKeys) {
        const originalValue = originalValues.get(key)
        if (originalValue === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = originalValue
        }
      }
    }
  })

  it('uses test-safe runtime key paths without committed key files', () => {
    expect(config.nodeEnv).toBe('test')
    expect(config.jwt.privateKeyPath).toBe('tests/runtime/generated-jwt-private.pem')
    expect(config.jwt.publicKeyPath).toBe('tests/runtime/generated-jwt-public.pem')
    expect(existsSync(resolve(process.cwd(), config.jwt.privateKeyPath))).toBe(false)
    expect(existsSync(resolve(process.cwd(), config.jwt.publicKeyPath))).toBe(false)
    expect(config.databaseUrl).toContain('localhost:5432/nce_test')
    expect(config.google.clientId).toBeTruthy()
    expect(config.google.clientSecret).toBeTruthy()
    expect(config.email.brevoApiKey).toBeTruthy()
    expect(config.cors.allowedOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ])
    expect(config.authRateLimit).toEqual({
      passwordLogin: {
        maxFailures: 3,
        windowMs: 60_000,
        lockoutMs: 60_000,
      },
      ipAttempts: {
        maxAttempts: 3,
        windowMs: 60_000,
      },
      maxTrackedKeys: 100,
    })
    expect(config.cleanupRetention).toEqual({
      authSessionRetentionDays: 30,
      notificationMetadataRetentionDays: 90,
    })
    expect(config.trustProxy).toEqual(['loopback'])
    expect(config.logLevel).toBe('silent')
    expect(config.logPretty).toBe(false)
    expect(config.nceAssets.root).toBe('tests/fixtures/nce-assets')
    expect(config.aiFeedback).toEqual({
      enabled: false,
      provider: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: undefined,
      timeoutMs: 10_000,
      maxInputChars: 12_000,
      maxOutputTokens: 1_200,
      imageInput: {
        maxBytes: 20 * 1024 * 1024,
        supportedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      },
      healthPath: '/models',
      routes: {
        lowCost: {
          model: 'gpt-5.4-nano',
          reasoningEffort: 'medium',
          supportsImageInput: false,
        },
        premium: {
          model: 'gpt-5.4-mini',
          reasoningEffort: 'high',
          supportsImageInput: true,
        },
      },
    })
  })

  it('rejects invalid AI image capability boolean values', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        'import("./src/config/env.ts").catch((error) => { console.error(error.message); process.exit(1); })',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AI_PREMIUM_SUPPORTS_IMAGE_INPUT: 'ture',
        },
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('AI_PREMIUM_SUPPORTS_IMAGE_INPUT')
  })
})
