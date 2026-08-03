/**
 * Location: frontend/playwright.synthetic.config.ts
 * Purpose: Run deterministic cross-tab cookie races against the synthetic API.
 * Why: Port 4010 must be an explicit opt-in and never replace real-backend checks.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'auth-cookie-race.spec.ts',
    'auth-cookie-timeout.spec.ts',
    'auth-recovery.spec.ts',
    'auth-storage-lock.spec.ts',
  ],
  // All synthetic specs mutate the same server-side cookie gates.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx e2e/auth-cookie-race.server.ts',
      cwd: __dirname,
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3010 --strictPort',
      cwd: __dirname,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:4010/api/v1' },
      url: 'http://127.0.0.1:3010',
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
