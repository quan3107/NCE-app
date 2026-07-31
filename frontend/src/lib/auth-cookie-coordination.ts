/**
 * Location: src/lib/auth-cookie-coordination.ts
 * Purpose: Coordinate refresh-cookie mutations across browser tabs and OAuth navigation.
 * Why: Every supported browser path needs one recoverable, cross-tab cookie-write boundary.
 */

import {
  localStorageOrNull,
  sessionStorageOrNull,
  storageGet,
  storageRemove,
  storageSet,
} from "./browser-storage";
import { runWithIndexedDbAuthLock } from "./auth-cookie-indexeddb-lock";

const AUTH_COOKIE_LOCK_NAME = 'nce-auth-cookie-operations';
const OAUTH_LEASE_KEY = 'nce:auth-cookie-oauth-lease';
const OAUTH_LEASE_OWNER_KEY = 'nce:auth-cookie-oauth-owner';
const OAUTH_LEASE_MS = 5 * 60 * 1000;
const LEASE_POLL_MS = 25;
const RETRY_LOCK = Symbol('retry-auth-cookie-lock');

type StorageLease = {
  ownerId: string;
  expiresAt: number;
};

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function browserStorage(): Storage | null {
  return localStorageOrNull();
}

function readLease(key: string): StorageLease | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }
  const raw = storageGet(storage, key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StorageLease>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      storageRemove(storage, key);
      return null;
    }
    return parsed as StorageLease;
  } catch {
    storageRemove(storage, key);
    return null;
  }
}

function ownedOAuthLeaseId(): string | null {
  const storage = sessionStorageOrNull();
  return storage ? storageGet(storage, OAUTH_LEASE_OWNER_KEY) : null;
}

function isOAuthLeaseAvailable(allowOwnedLease: boolean): boolean {
  const lease = readLease(OAUTH_LEASE_KEY);
  return Boolean(
    !lease ||
      (allowOwnedLease && lease.ownerId === ownedOAuthLeaseId()),
  );
}

function delayForLease(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, LEASE_POLL_MS);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitForOAuthLease(
  signal: AbortSignal,
  allowOwnedLease: boolean,
): Promise<void> {
  while (!isOAuthLeaseAvailable(allowOwnedLease)) {
    await delayForLease(signal);
  }
}

async function runWithIndexedDbLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: () => Promise<T>,
): Promise<T | typeof RETRY_LOCK> {
  return runWithIndexedDbAuthLock(signal, leaseMs, async () =>
    isOAuthLeaseAvailable(allowOwnedLease) ? operation() : RETRY_LOCK,
  );
}

export async function runWithCrossTabAuthLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof window === 'undefined') {
    return operation();
  }
  while (true) {
    await waitForOAuthLease(signal, allowOwnedLease);
    const result = navigator.locks
      ? await navigator.locks.request(
          AUTH_COOKIE_LOCK_NAME,
          { mode: 'exclusive', signal },
          () =>
            isOAuthLeaseAvailable(allowOwnedLease)
              ? operation()
              : RETRY_LOCK,
        )
      : await runWithIndexedDbLock(
          signal,
          allowOwnedLease,
          leaseMs,
          operation,
        );
    if (result !== RETRY_LOCK) {
      return result;
    }
  }
}

export function createOAuthLease(): void {
  const storage = browserStorage();
  const ownerStorage = sessionStorageOrNull();
  if (!storage || !ownerStorage) {
    return;
  }
  const ownerId = crypto.randomUUID();
  const leaseStored = storageSet(
    storage,
    OAUTH_LEASE_KEY,
    JSON.stringify({ ownerId, expiresAt: Date.now() + OAUTH_LEASE_MS }),
  );
  if (!leaseStored || !storageSet(ownerStorage, OAUTH_LEASE_OWNER_KEY, ownerId)) {
    storageRemove(storage, OAUTH_LEASE_KEY);
  }
}

export function clearOwnedOAuthLease(): void {
  const storage = browserStorage();
  const ownerStorage = sessionStorageOrNull();
  if (!storage || !ownerStorage) {
    return;
  }
  const ownerId = ownedOAuthLeaseId();
  if (readLease(OAUTH_LEASE_KEY)?.ownerId === ownerId) {
    storageRemove(storage, OAUTH_LEASE_KEY);
  }
  storageRemove(ownerStorage, OAUTH_LEASE_OWNER_KEY);
}

export function hasOwnedOAuthLease(): boolean {
  const ownerId = ownedOAuthLeaseId();
  return Boolean(ownerId && readLease(OAUTH_LEASE_KEY)?.ownerId === ownerId);
}
