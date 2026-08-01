/**
 * Location: src/lib/auth-cookie-indexeddb-lock.ts
 * Purpose: Persist the cross-navigation OAuth reservation in IndexedDB.
 * Why: Tabs need authoritative reservation metadata in addition to local ownership.
 */

import {
  openAuthCoordinationDatabase,
  runAuthCoordinationTransaction,
} from './auth-cookie-indexeddb-store';

export type AuthCoordinationLease = {
  name: string;
  ownerId: string;
  expiresAt: number;
};

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
