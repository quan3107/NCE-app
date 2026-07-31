/**
 * Location: src/lib/auth-cookie-coordination.ts
 * Purpose: Coordinate refresh-cookie mutations across browser tabs and OAuth navigation.
 * Why: Every supported browser path needs one recoverable, cross-tab cookie-write boundary.
 */

import {
  sessionStorageOrNull,
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

type OwnedOAuthLeaseRead =
  | { readable: true; storage: Storage; lease: OwnedOAuthLease | null }
  | { readable: false };

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function ownedOAuthLease(): OwnedOAuthLeaseRead {
  const storage = sessionStorageOrNull();
  if (!storage) {
    return { readable: false };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(OAUTH_LEASE_OWNER_KEY);
  } catch {
    return { readable: false };
  }
  if (!raw) {
    return { readable: true, storage, lease: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OwnedOAuthLease>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      storageRemove(storage, OAUTH_LEASE_OWNER_KEY);
      return { readable: true, storage, lease: null };
    }
    return {
      readable: true,
      storage,
      lease: parsed as OwnedOAuthLease,
    };
  } catch {
    storageRemove(storage, OAUTH_LEASE_OWNER_KEY);
    return { readable: true, storage, lease: null };
  }
}

function ownedOAuthLeaseId(): string | null {
  const ownership = ownedOAuthLease();
  return ownership.readable ? ownership.lease?.ownerId ?? null : null;
}

async function isOAuthLeaseAvailable(
  allowOwnedLease: boolean,
  signal?: AbortSignal,
): Promise<boolean> {
  const lease = await readIndexedDbAuthLease(OAUTH_LEASE_NAME, signal);
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
  while (!(await isOAuthLeaseAvailable(allowOwnedLease, signal))) {
    await delayForLease(signal);
  }
}

async function runWithIndexedDbLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T | typeof RETRY_LOCK> {
  return runWithIndexedDbAuthLock(signal, leaseMs, async (leaseSignal) =>
    (await isOAuthLeaseAvailable(allowOwnedLease, leaseSignal))
      ? operation(leaseSignal)
      : RETRY_LOCK,
  );
}

export async function runWithCrossTabAuthLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (typeof window === 'undefined') {
    return operation(signal);
  }
  while (true) {
    await waitForOAuthLease(signal, allowOwnedLease);
    const result = navigator.locks
      ? await navigator.locks.request(
          AUTH_COOKIE_LOCK_NAME,
          { mode: 'exclusive', signal },
          async () =>
            (await isOAuthLeaseAvailable(allowOwnedLease, signal))
              ? operation(signal)
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

export async function createOAuthLease(signal?: AbortSignal): Promise<void> {
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
    await writeIndexedDbAuthLease(
      { name: OAUTH_LEASE_NAME, ownerId, expiresAt },
      signal,
    );
  } catch (error) {
    storageRemove(ownerStorage, OAUTH_LEASE_OWNER_KEY);
    throw error;
  }
}

export async function clearOwnedOAuthLease(signal?: AbortSignal): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const reservation = await readIndexedDbAuthLease(OAUTH_LEASE_NAME, signal);
  const ownership = ownedOAuthLease();
  if (!reservation) {
    if (ownership.readable) {
      storageRemove(ownership.storage, OAUTH_LEASE_OWNER_KEY);
    }
    return;
  }
  if (!ownership.readable) {
    throw coordinationUnavailableError();
  }
  if (ownership.lease?.ownerId !== reservation.ownerId) {
    return;
  }
  await removeIndexedDbAuthLease(
    OAUTH_LEASE_NAME,
    reservation.ownerId,
    signal,
  );
  storageRemove(ownership.storage, OAUTH_LEASE_OWNER_KEY);
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
