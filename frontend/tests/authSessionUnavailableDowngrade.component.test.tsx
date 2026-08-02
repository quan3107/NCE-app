/**
 * Location: tests/authSessionUnavailableDowngrade.component.test.tsx
 * Purpose: Verify volatile authority reductions converge locally and across tabs.
 * Why: A failed storage write must not leave the initiating tab's stronger token live.
 */
import assert from 'node:assert/strict';

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, test, vi } from 'vitest';

import { useAuthSession } from '../src/lib/auth-session';
import { authenticatedRequestSignal } from '../src/lib/shared-auth-session';

const adminSnapshot = {
  sessionEpoch: 17,
  token: 'admin-token',
  liveUser: {
    id: 'same-user',
    name: 'Same User',
    email: 'same-user@example.com',
    role: 'admin',
  },
} as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('an unavailable role downgrade replaces the initiating bearer before returning', () => {
  let storedAdmin: string | null = JSON.stringify(adminSnapshot);
  const rejectedStorage = (read: () => string | null, remove: () => void) => ({
    getItem: read,
    removeItem: remove,
    setItem: () => {
      throw new DOMException('Storage write denied', 'QuotaExceededError');
    },
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: rejectedStorage(
      () => storedAdmin,
      () => {
        storedAdmin = null;
      },
    ),
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: rejectedStorage(
      () => null,
      () => undefined,
    ),
  });
  const posted: unknown[] = [];
  class TestBroadcastChannel {
    addEventListener() {}
    close() {}
    postMessage(value: unknown) {
      posted.push(value);
    }
    removeEventListener() {}
  }
  vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
  const view = renderHook(() => useAuthSession());
  const requestSignal = authenticatedRequestSignal();
  let accepted = false;

  act(() => {
    accepted = view.result.current.applyLiveSession({
      accessToken: 'student-token',
      user: {
        id: 'same-user',
        email: 'same-user@example.com',
        fullName: 'Same User',
        role: 'student',
      },
    });
  });

  assert.equal(accepted, true);
  assert.equal(view.result.current.liveUser?.role, 'student');
  assert.equal(view.result.current.tokenRef.current, 'student-token');
  assert.equal(storedAdmin, null);
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(posted, [
    {
      sessionEpoch: posted[0]?.sessionEpoch,
      token: 'student-token',
      liveUser: {
        id: 'same-user',
        name: 'Same User',
        email: 'same-user@example.com',
        role: 'student',
      },
    },
  ]);
});
