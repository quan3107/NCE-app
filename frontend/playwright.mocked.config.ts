/**
 * Location: frontend/playwright.mocked.config.ts
 * Purpose: Run browser workflows whose API state is supplied by route intercepts.
 * Why: Mocked UI coverage must be explicit and cannot stand in for backend checks.
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3010';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'classroom-workflow.spec.ts',
    'profile-layout.visual.spec.ts',
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3010 --strictPort',
    cwd: __dirname,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:4000/api/v1' },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
