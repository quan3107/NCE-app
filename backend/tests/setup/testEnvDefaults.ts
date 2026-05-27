/**
 * File: tests/setup/testEnvDefaults.ts
 * Purpose: Provide deterministic backend test environment defaults.
 * Why: Lets test collection and Prisma generation run without developer .env files or provider secrets.
 */
export function applyBackendTestEnvDefaults(): void {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL ??=
    'postgres://test_user:test_password@localhost:5432/nce_test'
  process.env.DIRECT_URL ??= process.env.DATABASE_URL
  process.env.JWT_PRIVATE_KEY_PATH ??= 'tests/fixtures/private.pem'
  process.env.JWT_PUBLIC_KEY_PATH ??= 'tests/fixtures/public.pem'
  process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id'
  process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret'
  process.env.GOOGLE_REDIRECT_URI ??=
    'http://localhost:4000/api/v1/auth/google/callback'
  process.env.BREVO_API_KEY ??= 'test-brevo-api-key'
  process.env.BREVO_SENDER_NAME ??= 'NCE Test Mailer'
  process.env.BREVO_SENDER_EMAIL ??= 'noreply.test@example.com'
  process.env.LOG_LEVEL ??= 'silent'
  process.env.LOG_PRETTY ??= 'false'
}
