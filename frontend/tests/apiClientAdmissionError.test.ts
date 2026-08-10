/**
 * Location: tests/apiClientAdmissionError.test.ts
 * Purpose: Preserve the public error type for locally rejected authenticated requests.
 * Why: Consumers use ApiError identity to distinguish auth failures from unknown errors.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError, apiClient } from '../src/lib/apiClient';
import { AuthCoordinator } from '../src/lib/auth-coordinator';
import { authBridge } from '../src/lib/authBridge';

test('anonymous required admission rejects with the ApiError contract', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return Response.json({ ok: true });
  };
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  authBridge.configure({
    waitUntilReady: () => coordinator.waitUntilReady(),
    admit: (mode) => coordinator.admit(mode),
    isCurrent: (candidate) => coordinator.isCurrent(candidate),
  });

  try {
    await assert.rejects(
      () => apiClient('/anonymous-required', { auth: 'required' }),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    authBridge.reset();
    globalThis.fetch = originalFetch;
  }
});
