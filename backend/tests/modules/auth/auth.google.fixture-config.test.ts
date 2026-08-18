/**
 * File: tests/modules/auth/auth.google.fixture-config.test.ts
 * Purpose: Require an explicit test-only Google OAuth provider endpoint.
 * Why: Browser OAuth checks must never depend on live Google credentials.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

describe('Google OAuth test fixture configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      AUTH_GOOGLE_TEST_FIXTURE_ENABLED: 'true',
      AUTH_GOOGLE_TEST_FIXTURE_ORIGIN: 'http://127.0.0.1:4000',
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('builds a local authorization URL only when explicitly enabled', async () => {
    const { buildGoogleAuthorizationUrl } =
      await import('../../../src/modules/auth/auth.google.oauth.js')

    const result = await buildGoogleAuthorizationUrl({
      redirectUri: 'http://127.0.0.1:4000/api/v1/auth/google/callback',
    })
    const authorizationUrl = new URL(result.authorizationUrl)

    expect(authorizationUrl.origin).toBe('http://127.0.0.1:4000')
    expect(authorizationUrl.pathname).toBe('/api/v1/auth/google/test-provider')
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizationUrl.searchParams.get('state')).toBe(result.state)
  })
})
