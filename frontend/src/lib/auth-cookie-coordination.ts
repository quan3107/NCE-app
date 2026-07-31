/**
 * Location: src/lib/auth-cookie-coordination.ts
 * Purpose: Coordinate refresh-cookie mutations across browser tabs and OAuth navigation.
 * Why: Every supported browser path needs one recoverable, cross-tab cookie-write boundary.
 */

import {
  sessionStorageOrNull,
  storageGet,
  storageRemove,
  storageSet,
} from "./browser-storage";
import {
  readIndexedDbAuthLease,
  removeIndexedDbAuthLease,
  runWithIndexedDbAuthLock,
  writeIndexedDbAuthLease,
} from "./auth-cookie-indexeddb-lock";

const AUTH_COOKIE_LOCK_NAME = 'nce-auth-cookie-operations';
const OAUTH_LEASE_NAME = 'oauth-reservation';
const OAUTH_LEASE_OWNER_KEY = 'nce:auth-cookie-oauth-owner';
const OAUTH_LEASE_MS = 5 * 60 * 1000;
const LEASE_POLL_MS = 25;
const RETRY_LOCK = Symbol('retry-auth-cookie-lock');

type OwnedOAuthLease = {
  ownerId: string;
  expiresAt: number;
};

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function ownedOAuthLease(): OwnedOAuthLease | null {
  const storage = sessionStorageOrNull();
  if (!storage) {
    return null;
  }
  const raw = storageGet(storage, OAUTH_LEASE_OWNER_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OwnedOAuthLease>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      storageRemove(storage, OAUTH_LEASE_OWNER_KEY);
      return null;
    }
    return parsed as OwnedOAuthLease;
  } catch {
    storageRemove(storage, OAUTH_LEASE_OWNER_KEY);
    return null;
  }
}

function ownedOAuthLeaseId(): string | null {
  return ownedOAuthLease()?.ownerId ?? null;
}

async function isOAuthLeaseAvailable(
  allowOwnedLease: boolean,
): Promise<boolean> {
  const lease = await readIndexedDbAuthLease(OAUTH_LEASE_NAME);
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
  while (!(await isOAuthLeaseAvailable(allowOwnedLease))) {
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
    (await isOAuthLeaseAvailable(allowOwnedLease))
      ? operation()
      : RETRY_LOCK,
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
          async () =>
            (await isOAuthLeaseAvailable(allowOwnedLease))
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

export async function createOAuthLease(): Promise<void> {
  const ownerStorage = sessionStorageOrNull();
  if (!ownerStorage) {
    throw coordinationUnavailableError();
  }
  const ownerId = crypto.randomUUID();
  const expiresAt = Date.now() + OAUTH_LEASE_MS;
  const ownerStored = storageSet(
    ownerStorage,
    OAUTH_LEASE_OWNER_KEY,
    JSON.stringify({ ownerId, expiresAt } satisfies OwnedOAuthLease),
  );
  if (!ownerStored) {
    throw coordinationUnavailableError();
  }
  try {
    await writeIndexedDbAuthLease({
      name: OAUTH_LEASE_NAME,
      ownerId,
      expiresAt,
    });
  } catch (error) {
    storageRemove(ownerStorage, OAUTH_LEASE_OWNER_KEY);
    throw error;
  }
}

export async function clearOwnedOAuthLease(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const ownerStorage = sessionStorageOrNull();
  if (!ownerStorage) {
    throw coordinationUnavailableError();
  }
  const ownerId = ownedOAuthLeaseId();
  if (!ownerId) {
    return;
  }
  await removeIndexedDbAuthLease(OAUTH_LEASE_NAME, ownerId);
  storageRemove(ownerStorage, OAUTH_LEASE_OWNER_KEY);
}

export function hasOwnedOAuthLease(): boolean {
  return Boolean(ownedOAuthLeaseId());
}

function coordinationUnavailableError(): Error {
  const error = new Error(
    'Cross-tab authentication coordination is unavailable.',
  );
  error.name = 'AuthCoordinationUnavailableError';
  return error;
}
