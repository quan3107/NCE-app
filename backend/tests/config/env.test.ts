/**
 * File: tests/config/env.test.ts
 * Purpose: Verify backend tests receive deterministic environment defaults.
 * Why: Keeps test collection independent from developer .env files and provider secrets.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from '../../src/config/env.js'

describe('test environment defaults', () => {
  it('uses explicit test-only defaults before runtime config is imported', () => {
    expect(config.nodeEnv).toBe('test')
    expect(config.databaseUrl).toBe(
      'postgres://test_user:test_password@localhost:5432/nce_test',
    )
    expect(config.jwt.privateKeyPath).toBe('tests/runtime/generated-jwt-private.pem')
    expect(config.jwt.publicKeyPath).toBe('tests/runtime/generated-jwt-public.pem')
    expect(existsSync(resolve(process.cwd(), config.jwt.privateKeyPath))).toBe(false)
    expect(existsSync(resolve(process.cwd(), config.jwt.publicKeyPath))).toBe(false)
    expect(config.google).toEqual({
      clientId: 'test-google-client-id',
      clientSecret: 'test-google-client-secret',
      redirectUri: 'http://localhost:4000/api/v1/auth/google/callback',
    })
    expect(config.email).toEqual({
      brevoApiKey: 'test-brevo-api-key',
      senderName: 'NCE Test Mailer',
      senderEmail: 'noreply.test@example.com',
    })
    expect(config.logLevel).toBe('silent')
    expect(config.logPretty).toBe(false)
  })
})
