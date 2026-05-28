/**
 * File: tests/config/env.test.ts
 * Purpose: Verify backend tests receive deterministic environment defaults.
 * Why: Keeps test collection independent from developer .env files and provider secrets.
 */
import { describe, expect, it } from 'vitest'
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
  'TRUST_PROXY',
  'LOG_LEVEL',
  'LOG_PRETTY',
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
      expect(process.env.TRUST_PROXY).toBe('loopback')
      expect(process.env.LOG_LEVEL).toBe('silent')
      expect(process.env.LOG_PRETTY).toBe('false')
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
    expect(config.trustProxy).toEqual(['loopback'])
    expect(config.logLevel).toBe('silent')
    expect(config.logPretty).toBe(false)
  })
})
