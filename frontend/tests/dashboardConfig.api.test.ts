/// <reference lib="dom" />
/**
 * Location: tests/dashboardConfig.api.test.ts
 * Purpose: Validate dashboard config API normalization and fallback behavior.
 * Why: Protects role dashboard rendering from malformed or unavailable config responses.
 */

import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const API_BASE_URL = 'http://localhost:4000/api/v1';

type FetchMyDashboardConfig = typeof import('../src/features/dashboard-config/api').fetchMyDashboardConfig;
type SaveMyDashboardConfig = typeof import('../src/features/dashboard-config/api').saveMyDashboardConfig;
type ResetMyDashboardConfig = typeof import('../src/features/dashboard-config/api').resetMyDashboardConfig;
type FetchDashboardWidgetDefaults =
  typeof import('../src/features/dashboard-config/api').fetchDashboardWidgetDefaults;

let fetchMyDashboardConfig: FetchMyDashboardConfig;
let saveMyDashboardConfig: SaveMyDashboardConfig;
let resetMyDashboardConfig: ResetMyDashboardConfig;
let fetchDashboardWidgetDefaults: FetchDashboardWidgetDefaults;

before(async () => {
  if (typeof process !== 'undefined' && process.env) {
    process.env.VITE_API_BASE_URL = API_BASE_URL;
  }

  const module = await import('../src/features/dashboard-config/api');
  fetchMyDashboardConfig = module.fetchMyDashboardConfig;
  saveMyDashboardConfig = module.saveMyDashboardConfig;
  resetMyDashboardConfig = module.resetMyDashboardConfig;
  fetchDashboardWidgetDefaults = module.fetchDashboardWidgetDefaults;
});

const createStorage = (): Storage => ({
  get length() {
    return 0;
  },
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
});

const withPatchedGlobals = async (
  overrides: {
    fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    localStorage?: Storage;
  },
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

  if (overrides.fetch) {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = overrides.fetch;
  }

  if (overrides.localStorage) {
    (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = overrides.localStorage;
  }

  try {
    await run();
  } finally {
    if (overrides.fetch) {
      (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
    }

    if (overrides.localStorage) {
      if (originalLocalStorage === undefined) {
        delete (globalThis as Record<string, unknown>).localStorage;
      } else {
        (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
          originalLocalStorage as Storage;
      }
    }
  }
};

test('fetchMyDashboardConfig validates and returns API payload', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            role: 'student',
            version: '2026-02-06-001',
            personalized: true,
            widgets: [
              {
                id: 'student_due_soon',
                type: 'stat',
                label: 'Due Soon',
                icon_name: 'clock',
                color: 'text-orange-500',
                data_source: 'student.assignments_due_soon',
                value_format: 'number',
                visible: true,
                order: 0,
                position: { x: 0, y: 0, w: 1, h: 1 },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      localStorage: createStorage(),
    },
    async () => {
      const payload = await fetchMyDashboardConfig();

      assert.equal(payload.role, 'student');
      assert.equal(payload.personalized, true);
      assert.equal(payload.widgets[0].id, 'student_due_soon');
    },
  );
});

test('fetchDashboardWidgetDefaults falls back when endpoint fails', async () => {
  await withPatchedGlobals(
    {
      fetch: async () =>
        new Response(JSON.stringify({ message: 'Service unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      localStorage: createStorage(),
    },
    async () => {
      const payload = await fetchDashboardWidgetDefaults('teacher');

      assert.equal(payload.role, 'teacher');
      assert.ok(payload.widgets.length > 0);
      assert.equal(payload.widgets[0].id, 'teacher_active_assignments');
    },
  );
});

test('saveMyDashboardConfig sends PUT and returns validated payload', async () => {
  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        assert.equal(init?.method, 'PUT');

        return new Response(
          JSON.stringify({
            role: 'admin',
            version: '2026-02-06-001',
            personalized: true,
            widgets: [
              {
                id: 'admin_total_users',
                type: 'stat',
                label: 'Total Users',
                icon_name: 'users',
                color: 'text-muted-foreground',
                data_source: 'admin.users_total',
                value_format: 'number',
                visible: true,
                order: 0,
                position: { x: 0, y: 0, w: 1, h: 1 },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
      localStorage: createStorage(),
    },
    async () => {
      const payload = await saveMyDashboardConfig({
        widgets: [
          {
            id: 'admin_total_users',
            visible: true,
            order: 0,
            position: { x: 0, y: 0, w: 1, h: 1 },
          },
        ],
      });

      assert.equal(payload.role, 'admin');
      assert.equal(payload.widgets[0].id, 'admin_total_users');
    },
  );
});

test('resetMyDashboardConfig issues DELETE and tolerates 204', async () => {
  await withPatchedGlobals(
    {
      fetch: async (_input, init) => {
        assert.equal(init?.method, 'DELETE');
        return new Response(null, { status: 204 });
      },
      localStorage: createStorage(),
    },
    async () => {
      await resetMyDashboardConfig();
    },
  );
});
