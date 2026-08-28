/**
 * Location: frontend/playwright.config.ts
 * Purpose: Configure Playwright browser checks for critical frontend workflows.
 * Why: Validates browser workflows against an environment-selected real backend.
 */

import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3010';
const frontendURL = new URL(baseURL);
if (frontendURL.protocol !== 'http:') {
  throw new Error('PLAYWRIGHT_BASE_URL must use http for the local Vite server.');
}
const frontendHost = frontendURL.hostname.replace(/^\[(.*)\]$/, '$1');
const frontendPort = frontendURL.port || '80';
const apiBaseURL =
  process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
const backendCommand = process.env.PLAYWRIGHT_BACKEND_COMMAND;
const backendEnvironment = process.env.CI
  ? {
      // Two workers exceed the test backend's three-attempt refresh allowance.
      AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS:
        process.env.AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS ?? '100',
    }
  : undefined;
const reuseExistingServer = !process.env.CI;

const webServer = [
  ...(backendCommand
    ? [
        {
          command: backendCommand,
          cwd: path.resolve(__dirname, '../backend'),
          url:
            process.env.PLAYWRIGHT_BACKEND_HEALTH_URL ??
            'http://127.0.0.1:4000/health',
          env: backendEnvironment,
          reuseExistingServer,
          timeout: 120_000,
        },
      ]
    : []),
  {
    command: `npm run dev -- --host ${frontendHost} --port ${frontendPort} --strictPort`,
    cwd: __dirname,
    env: { VITE_API_BASE_URL: apiBaseURL },
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'real-backend.spec.ts',
    'real-backend-auth-ordering.spec.ts',
    'real-backend-auth-storage-failure.spec.ts',
    'real-backend-mutations.spec.ts',
    'real-backend-generic-assignments.spec.ts',
  ],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
