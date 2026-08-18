/**
 * File: src/modules/auth/auth.google.fixture.ts
 * Purpose: Provide a deterministic loopback-only OAuth provider for browser tests.
 * Why: PKCE and callback recovery need full redirects without live Google credentials.
 */
import { createHash, randomBytes } from 'node:crypto'

import { z } from 'zod'

import { config } from '../../config/env.js'
import { createAuthError } from './auth.errors.js'
import type { GoogleProfile } from './auth.google.profile.js'

const AUTHORIZATION_TTL_MS = 5 * 60 * 1000
const providerRequestSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  response_type: z.literal('code'),
  state: z.string().min(16).max(512),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  code_challenge_method: z.literal('S256'),
})
const providerDecisionSchema = z.object({
  state: z.string().min(16).max(512),
  outcome: z.enum(['student', 'teacher', 'admin', 'cancel', 'token_failure']),
})

type TestRole = 'student' | 'teacher' | 'admin'
type ProviderRequest = z.infer<typeof providerRequestSchema> & {
  expiresAt: number
}
type AuthorizationCode = {
  codeChallenge: string
  expiresAt: number
  profile: GoogleProfile | null
}

const requests = new Map<string, ProviderRequest>()
const authorizationCodes = new Map<string, AuthorizationCode>()

const profiles: Record<TestRole, GoogleProfile> = {
  student: {
    providerSubject: 'nce-test-student',
    providerIssuer: 'https://accounts.google.com',
    normalizedEmail: 'amelia.chan@ielts.local',
    emailVerified: true,
    fullName: 'Amelia Chan',
  },
  teacher: {
    providerSubject: 'google-oauth2|sarah.tutor',
    providerIssuer: 'https://accounts.google.com',
    normalizedEmail: 'sarah.tutor@ielts.local',
    emailVerified: true,
    fullName: 'Sarah Tutor',
  },
  admin: {
    providerSubject: 'nce-test-admin',
    providerIssuer: 'https://accounts.google.com',
    normalizedEmail: 'rosa.admin@ielts.local',
    emailVerified: true,
    fullName: 'Rosa Admin',
  },
}

function assertFixtureEnabled(): void {
  if (!config.google.testFixture.enabled || config.nodeEnv === 'production') {
    throw createAuthError(404, 'Not Found')
  }
}

function pruneExpired(): void {
  const now = Date.now()
  for (const [state, request] of requests) {
    if (request.expiresAt <= now) requests.delete(state)
  }
  for (const [code, authorization] of authorizationCodes) {
    if (authorization.expiresAt <= now) authorizationCodes.delete(code)
  }
}

function expectedRedirectUri(): string {
  const configured = config.google.redirectUri
  if (!configured) {
    throw createAuthError(500, 'Test OAuth callback URI is not configured.')
  }
  return configured
}

function providerDecisionUrl(state: string, outcome: string): string {
  const url = new URL(
    '/api/v1/auth/google/test-provider/complete',
    config.google.testFixture.origin,
  )
  url.searchParams.set('state', state)
  url.searchParams.set('outcome', outcome)
  return url.toString()
}

export function createGoogleTestProviderPage(query: unknown): string {
  assertFixtureEnabled()
  pruneExpired()
  const parsed = providerRequestSchema.parse(query)
  if (
    parsed.client_id !== config.google.clientId ||
    parsed.redirect_uri !== expectedRedirectUri()
  ) {
    throw createAuthError(400, 'Invalid local OAuth fixture request.')
  }
  requests.set(parsed.state, {
    ...parsed,
    expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
  })

  const action = (label: string, outcome: string) =>
    `<a href="${providerDecisionUrl(parsed.state, outcome)}">${label}</a>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Local Google OAuth fixture</title><style>
body{font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:1rem;color:#172033}
main{border:1px solid #c9d3e3;border-radius:.75rem;padding:2rem;box-shadow:0 8px 30px #17203314}
.actions{display:grid;gap:.75rem}a{padding:.75rem 1rem;border:1px solid #5676a6;border-radius:.5rem;color:#15345f;text-decoration:none;text-align:center}
.secondary{margin-top:1rem}small{color:#526174}</style></head><body><main>
<h1>Local Google OAuth fixture</h1><p>Select a deterministic test identity.</p><div class="actions">
${action('Continue as Student', 'student')}${action('Continue as Teacher', 'teacher')}${action('Continue as Admin', 'admin')}
</div><div class="actions secondary">${action('Cancel sign-in', 'cancel')}${action('Simulate token failure', 'token_failure')}</div>
<p><small>Available only when the backend runs in explicit test-fixture mode.</small></p>
</main></body></html>`
}

export function completeGoogleTestProvider(query: unknown): string {
  assertFixtureEnabled()
  pruneExpired()
  const decision = providerDecisionSchema.parse(query)
  const request = requests.get(decision.state)
  if (!request) {
    throw createAuthError(400, 'Local OAuth fixture request expired.')
  }
  requests.delete(decision.state)
  const callback = new URL(request.redirect_uri)
  callback.searchParams.set('state', decision.state)
  if (decision.outcome === 'cancel') {
    callback.searchParams.set('error', 'access_denied')
    return callback.toString()
  }

  const code = `nce_test_${randomBytes(24).toString('base64url')}`
  authorizationCodes.set(code, {
    codeChallenge: request.code_challenge,
    expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
    profile: decision.outcome === 'token_failure' ? null : profiles[decision.outcome],
  })
  callback.searchParams.set('code', code)
  return callback.toString()
}

export async function consumeGoogleTestAuthorizationCode(params: {
  code: string
  codeVerifier: string
}): Promise<GoogleProfile> {
  assertFixtureEnabled()
  pruneExpired()
  const authorization = authorizationCodes.get(params.code)
  authorizationCodes.delete(params.code)
  if (!authorization) {
    throw createAuthError(401, 'Local OAuth authorization code is invalid or expired.')
  }
  const challenge = createHash('sha256').update(params.codeVerifier).digest('base64url')
  if (challenge !== authorization.codeChallenge) {
    throw createAuthError(401, 'Local OAuth PKCE verification failed.')
  }
  if (!authorization.profile) {
    throw createAuthError(401, 'Unable to complete Google sign-in. Please try again.')
  }
  return authorization.profile
}

export function resetGoogleTestProvider(): void {
  requests.clear()
  authorizationCodes.clear()
}
