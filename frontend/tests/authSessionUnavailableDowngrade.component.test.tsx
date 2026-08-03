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

function renderLiveAdminWithRejectedWrites(posted: unknown[] = []) {
  let storedAdmin: string | null = null;
  let storedFallback: string | null = null;
  let rejectWrites = false;
  const storage = (
    read: () => string | null,
    write: (value: string | null) => void,
  ) => ({
    getItem: read,
    removeItem: () => write(null),
    setItem: (_key: string, value: string) => {
      if (rejectWrites) {
        throw new DOMException('Storage write denied', 'QuotaExceededError');
      }
      write(value);
    },
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage(() => storedAdmin, (value) => { storedAdmin = value; }),
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: storage(() => storedFallback, (value) => { storedFallback = value; }),
  });
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

  act(() => {
    assert.equal(
      view.result.current.applyLiveSession({
        accessToken: adminSnapshot.token,
        user: {
          id: adminSnapshot.liveUser.id,
          email: adminSnapshot.liveUser.email,
          fullName: adminSnapshot.liveUser.name,
          role: adminSnapshot.liveUser.role,
        },
      }),
      true,
    );
  });
  rejectWrites = true;
  posted.length = 0;
  return { view, readStoredAdmin: () => storedAdmin };
}

test('an unavailable role downgrade replaces the initiating bearer before returning', () => {
  const posted: unknown[] = [];
  const { view, readStoredAdmin } = renderLiveAdminWithRejectedWrites(posted);
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
  assert.equal(readStoredAdmin(), null);
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(posted, [
    {
      sessionEpoch: posted[0]?.sessionEpoch,
      profileRevision: 0,
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

test('an unavailable account switch retires the previous bearer', () => {
  const { view, readStoredAdmin } = renderLiveAdminWithRejectedWrites();
  const requestSignal = authenticatedRequestSignal();
  let accepted = true;

  act(() => {
    accepted = view.result.current.applyLiveSession({
      accessToken: 'user-b-token',
      user: {
        id: 'user-b',
        email: 'user-b@example.com',
        fullName: 'User B',
        role: 'student',
      },
    });
  });

  assert.equal(accepted, true);
  assert.equal(view.result.current.liveUser?.id, 'user-b');
  assert.equal(view.result.current.tokenRef.current, 'user-b-token');
  assert.equal(readStoredAdmin(), null);
  assert.equal(requestSignal.aborted, true);
});

test('failed durable removal retires live authority and reloads it provisionally', () => {
  const localValues = new Map<string, string>();
  const sessionValues = new Map<string, string>();
  let rejectPersistence = false;
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      if (rejectPersistence) throw new DOMException('Removal denied', 'SecurityError');
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      if (rejectPersistence) {
        throw new DOMException('Storage write denied', 'QuotaExceededError');
      }
      values.set(key, value);
    },
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage(localValues),
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: storage(sessionValues),
  });
  vi.stubGlobal('BroadcastChannel', undefined);
  const view = renderHook(() => useAuthSession());

  act(() => {
    assert.equal(
      view.result.current.applyLiveSession({
        accessToken: 'admin-token',
        user: {
          id: 'same-user',
          email: 'same-user@example.com',
          fullName: 'Same User',
          role: 'admin',
        },
      }),
      true,
    );
  });
  rejectPersistence = true;

  act(() => {
    assert.equal(
      view.result.current.applyLiveSession({
        accessToken: 'student-token',
        user: {
          id: 'same-user',
          email: 'same-user@example.com',
          fullName: 'Same User',
          role: 'student',
        },
      }),
      false,
    );
  });

  assert.equal(view.result.current.liveUser, null);
  assert.equal(view.result.current.tokenRef.current, null);
  assert.match(localValues.get('currentUser') ?? '', /admin-token/);
  cleanup();

  const reloaded = renderHook(() => useAuthSession());
  assert.equal(reloaded.result.current.liveUser, null);
  assert.equal(reloaded.result.current.tokenRef.current, null);
  assert.equal(reloaded.result.current.shouldRefreshOnMountRef.current, true);
});
