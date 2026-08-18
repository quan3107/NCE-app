/**
 * File: tests/modules/auth/auth.google.fixture.test.ts
 * Purpose: Verify the deterministic local OAuth provider contract.
 * Why: PKCE, cancellation, token failures, and retries need browser-safe fixtures.
 */
import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }
const verifier = 'v'.repeat(64)
const challenge = createHash('sha256').update(verifier).digest('base64url')
const fixtureState = 'fixture-state-value'

describe('Google OAuth local provider fixture', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      AUTH_GOOGLE_TEST_FIXTURE_ENABLED: 'true',
      AUTH_GOOGLE_TEST_FIXTURE_ORIGIN: 'http://127.0.0.1:4000',
      GOOGLE_REDIRECT_URI: 'http://127.0.0.1:4000/api/v1/auth/google/callback',
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('issues a one-use role profile only after a matching PKCE verifier', async () => {
    const fixture = await import('../../../src/modules/auth/auth.google.fixture.js')
    fixture.resetGoogleTestProvider()
    const page = fixture.createGoogleTestProviderPage({
      client_id: 'test-google-client-id',
      redirect_uri: 'http://127.0.0.1:4000/api/v1/auth/google/callback',
      response_type: 'code',
      state: fixtureState,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    expect(page).toContain('Continue as Student')
    const callback = new URL(
      fixture.completeGoogleTestProvider({
        state: fixtureState,
        outcome: 'student',
      }),
    )
    const code = callback.searchParams.get('code')

    expect(callback.searchParams.get('state')).toBe(fixtureState)
    expect(code).toBeTruthy()
    await expect(
      fixture.consumeGoogleTestAuthorizationCode({
        code: code ?? '',
        codeVerifier: verifier,
      }),
    ).resolves.toMatchObject({
      normalizedEmail: 'amelia.chan@ielts.local',
      emailVerified: true,
    })
    await expect(
      fixture.consumeGoogleTestAuthorizationCode({
        code: code ?? '',
        codeVerifier: verifier,
      }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns provider denial and deterministic token failure callbacks', async () => {
    const fixture = await import('../../../src/modules/auth/auth.google.fixture.js')
    fixture.resetGoogleTestProvider()

    for (const [state, outcome, expectedParameter] of [
      ['cancel-state-value', 'cancel', 'error'],
      ['failure-state-value', 'token_failure', 'code'],
    ] as const) {
      fixture.createGoogleTestProviderPage({
        client_id: 'test-google-client-id',
        redirect_uri: 'http://127.0.0.1:4000/api/v1/auth/google/callback',
        response_type: 'code',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      const callback = new URL(fixture.completeGoogleTestProvider({ state, outcome }))
      expect(callback.searchParams.get(expectedParameter)).toBeTruthy()

      if (outcome === 'token_failure') {
        await expect(
          fixture.consumeGoogleTestAuthorizationCode({
            code: callback.searchParams.get('code') ?? '',
            codeVerifier: verifier,
          }),
        ).rejects.toMatchObject({ statusCode: 401 })
      }
    }
  })

  it('maps provider denial to a concise terminal error before session work', async () => {
    const { completeGoogleAuthorization } =
      await import('../../../src/modules/auth/auth.google.js')

    await expect(
      completeGoogleAuthorization(
        { error: 'access_denied', state: fixtureState },
        {
          redirectUri: 'http://127.0.0.1:4000/api/v1/auth/google/callback',
          expectedState: fixtureState,
          codeVerifier: verifier,
          context: {},
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Google sign-in was cancelled. Please try again.',
    })
  })
})
