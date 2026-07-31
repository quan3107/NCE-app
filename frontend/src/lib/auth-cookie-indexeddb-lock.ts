/**
 * Location: src/lib/auth-cookie-indexeddb-lock.ts
 * Purpose: Serialize auth-cookie operations when Web Locks are unavailable.
 * Why: A renewed, fenced IndexedDB lease prevents concurrent cookie writers.
 */

import {
  openAuthCoordinationDatabase,
  runAuthCoordinationTransaction,
} from './auth-cookie-indexeddb-store';

const LOCK_NAME = 'auth-cookie-operations';
const LOCK_POLL_MS = 25;
const MINIMUM_LEASE_MS = 60_000;

export type AuthCoordinationLease = {
  name: string;
  ownerId: string;
  expiresAt: number;
  fence?: number;
};

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function readLease(
  database: IDBDatabase,
  name: string,
  signal?: AbortSignal,
): Promise<AuthCoordinationLease | null> {
  return runAuthCoordinationTransaction(database, 'readonly', signal, (store, setResult) => {
    const request = store.get(name);
    request.onsuccess = () => {
      const stored = request.result as AuthCoordinationLease | undefined;
      setResult(stored && stored.expiresAt > Date.now() ? stored : null);
    };
  });
}

function writeLease(
  database: IDBDatabase,
  lease: AuthCoordinationLease,
  signal?: AbortSignal,
): Promise<void> {
  return runAuthCoordinationTransaction(database, 'readwrite', signal, (store, setResult) => {
    setResult(undefined);
    store.put(lease);
  });
}

function removeLease(
  database: IDBDatabase,
  name: string,
  ownerId: string,
  signal?: AbortSignal,
): Promise<void> {
  return runAuthCoordinationTransaction(database, 'readwrite', signal, (store, setResult) => {
    setResult(undefined);
    const request = store.get(name);
    request.onsuccess = () => {
      const stored = request.result as AuthCoordinationLease | undefined;
      if (stored?.ownerId === ownerId) store.delete(name);
    };
  });
}

function tryAcquireLease(
  database: IDBDatabase,
  ownerId: string,
  leaseMs: number,
  signal: AbortSignal,
): Promise<AuthCoordinationLease | null> {
  return runAuthCoordinationTransaction(database, 'readwrite', signal, (store, setResult) => {
    setResult(null);
    const request = store.get(LOCK_NAME);
    request.onsuccess = () => {
      const current = request.result as AuthCoordinationLease | undefined;
      if (current && current.expiresAt > Date.now()) return;
      const lease: AuthCoordinationLease = {
        name: LOCK_NAME,
        ownerId,
        expiresAt: Date.now() + leaseMs,
        fence: (current?.fence ?? 0) + 1,
      };
      store.put(lease);
      setResult(lease);
    };
  });
}

function updateOwnedLease(
  database: IDBDatabase,
  lease: AuthCoordinationLease,
  leaseMs: number,
  release: boolean,
): Promise<boolean> {
  return runAuthCoordinationTransaction(database, 'readwrite', undefined, (store, setResult) => {
    setResult(false);
    const request = store.get(LOCK_NAME);
    request.onsuccess = () => {
      const current = request.result as AuthCoordinationLease | undefined;
      if (
        current?.ownerId !== lease.ownerId ||
        current.fence !== lease.fence
      ) {
        return;
      }
      store.put({
        ...current,
        expiresAt: release ? 0 : Date.now() + leaseMs,
      });
      setResult(true);
    };
  });
}

function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, LOCK_POLL_MS);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() =>
      signal.removeEventListener('abort', onAbort),
    );
  });
}

async function withDatabase<T>(
  signal: AbortSignal | undefined,
  operation: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  const database = await openAuthCoordinationDatabase(signal);
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

export function readIndexedDbAuthLease(
  name: string,
  signal?: AbortSignal,
): Promise<AuthCoordinationLease | null> {
  return withDatabase(signal, (database) => readLease(database, name, signal));
}

export function writeIndexedDbAuthLease(
  lease: AuthCoordinationLease,
  signal?: AbortSignal,
): Promise<void> {
  return withDatabase(signal, (database) => writeLease(database, lease, signal));
}

export function removeIndexedDbAuthLease(
  name: string,
  ownerId: string,
  signal?: AbortSignal,
): Promise<void> {
  return withDatabase(signal, (database) =>
    removeLease(database, name, ownerId, signal),
  );
}

export async function runWithIndexedDbAuthLock<T>(
  signal: AbortSignal,
  requestedLeaseMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const leaseMs = Math.max(requestedLeaseMs, MINIMUM_LEASE_MS);
  return withDatabase(signal, async (database) => {
    const ownerId = crypto.randomUUID();
    let lease: AuthCoordinationLease | null = null;
    while (!(lease = await tryAcquireLease(database, ownerId, leaseMs, signal))) {
      await delay(signal);
    }

    const operationController = new AbortController();
    const abortOperation = () => operationController.abort();
    signal.addEventListener('abort', abortOperation, { once: true });
    const renew = async () => {
      if (!lease || !(await updateOwnedLease(database, lease, leaseMs, false))) {
        operationController.abort();
      }
    };
    let renewalTail = Promise.resolve();
    const renewalTimer = setInterval(() => {
      renewalTail = renewalTail.then(renew, abortOperation);
    }, Math.min(1_000, Math.max(25, Math.floor(leaseMs / 3))));

    try {
      const result = await abortable(
        operation(operationController.signal),
        operationController.signal,
      );
      await renewalTail;
      await renew();
      if (operationController.signal.aborted) throw abortError();
      return result;
    } finally {
      clearInterval(renewalTimer);
      signal.removeEventListener('abort', abortOperation);
      await renewalTail.catch(() => undefined);
      if (lease) await updateOwnedLease(database, lease, leaseMs, true);
    }
  });
}
