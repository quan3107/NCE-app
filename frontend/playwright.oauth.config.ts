/**
 * Location: frontend/playwright.oauth.config.ts
 * Purpose: Run provider-safe OAuth redirects against an explicit test backend.
 * Why: Live Google credentials must never be required for local browser coverage.
 */
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const frontendOrigin = 'http://127.0.0.1:3010';
const backendOrigin = 'http://127.0.0.1:4000';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'real-backend-oauth.spec.ts',
    'real-backend-profile-concurrency.spec.ts',
  ],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: frontendOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../backend'),
      env: {
        NODE_ENV: 'development',
        PORT: '4000',
        AUTH_GOOGLE_TEST_FIXTURE_ENABLED: 'true',
        AUTH_GOOGLE_TEST_FIXTURE_ORIGIN: backendOrigin,
        GOOGLE_REDIRECT_URI: `${backendOrigin}/api/v1/auth/google/callback`,
        CORS_ALLOWED_ORIGINS: frontendOrigin,
        AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS: '100',
      },
      url: `${backendOrigin}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3010 --strictPort',
      cwd: __dirname,
      env: { VITE_API_BASE_URL: `${backendOrigin}/api/v1` },
      url: frontendOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
