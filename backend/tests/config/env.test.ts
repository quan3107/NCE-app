/**
 * File: tests/config/env.test.ts
 * Purpose: Verify backend tests receive deterministic environment defaults.
 * Why: Keeps test collection independent from developer .env files and provider secrets.
 */
import { describe, expect, it } from 'vitest'

import { config } from '../../src/config/env.js'

describe('test environment defaults', () => {
  it('uses explicit test-only defaults before runtime config is imported', () => {
    expect(config.nodeEnv).toBe('test')
    expect(config.databaseUrl).toBe(
      'postgres://test_user:test_password@localhost:5432/nce_test',
    )
    expect(config.jwt.privateKeyPath).toBe('tests/fixtures/private.pem')
    expect(config.jwt.publicKeyPath).toBe('tests/fixtures/public.pem')
    expect(config.google).toEqual({
      clientId: 'test-google-client-id',
      clientSecret: 'test-google-client-secret',
      redirectUri: 'http://localhost:4000/api/auth/google/callback',
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
