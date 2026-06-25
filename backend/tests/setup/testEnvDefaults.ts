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
  process.env.JWT_PRIVATE_KEY_PATH ??= 'tests/runtime/generated-jwt-private.pem'
  process.env.JWT_PUBLIC_KEY_PATH ??= 'tests/runtime/generated-jwt-public.pem'
  process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id'
  process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret'
  process.env.GOOGLE_REDIRECT_URI ??= 'http://localhost:4000/api/v1/auth/google/callback'
  process.env.BREVO_API_KEY ??= 'test-brevo-api-key'
  process.env.BREVO_SENDER_NAME ??= 'NCE Test Mailer'
  process.env.BREVO_SENDER_EMAIL ??= 'noreply.test@example.com'
  process.env.CORS_ALLOWED_ORIGINS ??=
    'http://localhost:5173,http://127.0.0.1:5173'
  process.env.AUTH_PASSWORD_LOGIN_MAX_FAILURES ??= '3'
  process.env.AUTH_PASSWORD_LOGIN_WINDOW_MS ??= '60000'
  process.env.AUTH_PASSWORD_LOGIN_LOCKOUT_MS ??= '60000'
  process.env.AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS ??= '3'
  process.env.AUTH_IP_RATE_LIMIT_WINDOW_MS ??= '60000'
  process.env.AUTH_RATE_LIMIT_MAX_TRACKED_KEYS ??= '100'
  process.env.TRUST_PROXY ??= 'loopback'
  process.env.LOG_LEVEL ??= 'silent'
  process.env.LOG_PRETTY ??= 'false'
  process.env.NCE_ASSET_ROOT ??= 'tests/fixtures/nce-assets'
  process.env.AI_FEEDBACK_ENABLED ??= 'false'
  process.env.AI_PROVIDER ??= 'openai-compatible'
  process.env.AI_BASE_URL ??= 'https://api.openai.com/v1'
  process.env.AI_API_KEY = ''
  process.env.AI_TIMEOUT_MS ??= '10000'
  process.env.AI_MAX_INPUT_CHARS ??= '12000'
  process.env.AI_MAX_OUTPUT_TOKENS ??= '1200'
  process.env.AI_HEALTH_PATH ??= '/models'
  process.env.AI_LOW_COST_MODEL ??= 'gpt-5.4-nano'
  process.env.AI_LOW_COST_REASONING_EFFORT ??= 'medium'
  process.env.AI_LOW_COST_SUPPORTS_IMAGE_INPUT ??= 'false'
  process.env.AI_PREMIUM_MODEL ??= 'gpt-5.4-mini'
  process.env.AI_PREMIUM_REASONING_EFFORT ??= 'high'
  process.env.AI_PREMIUM_SUPPORTS_IMAGE_INPUT ??= 'true'
  process.env.AI_IMAGE_MAX_BYTES ??= '20971520'
  process.env.AI_IMAGE_SUPPORTED_MIME_TYPES ??= 'image/png,image/jpeg,image/webp,image/gif'
}
