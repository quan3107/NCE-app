/**
 * Location: src/lib/auth-cookie-indexeddb-store.ts
 * Purpose: Open the auth coordination database and run cancellable transactions.
 * Why: IndexedDB admission must obey the same deadline as the auth operation.
 */

const DATABASE_NAME = 'nce-auth-coordination';
const DATABASE_VERSION = 1;
const LOCK_STORE_NAME = 'locks';

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function coordinationUnavailableError(): Error {
  const error = new Error(
    'Cross-tab authentication coordination is unavailable.',
  );
  error.name = 'AuthCoordinationUnavailableError';
  return error;
}

export function openAuthCoordinationDatabase(
  signal?: AbortSignal,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    let factory: IDBFactory;
    let request: IDBOpenDBRequest;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      return true;
    };
    const onAbort = () => finish(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      factory = globalThis.indexedDB;
      if (!factory) throw new Error();
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      finish(coordinationUnavailableError());
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCK_STORE_NAME)) {
        request.result.createObjectStore(LOCK_STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => {
      if (finish()) resolve(request.result);
      else request.result.close();
    };
    request.onerror = () => finish(coordinationUnavailableError());
    request.onblocked = () => finish(coordinationUnavailableError());
  });
}

export function runAuthCoordinationTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  signal: AbortSignal | undefined,
  action: (store: IDBObjectStore, setResult: (value: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    let result!: T;
    let settled = false;
    const transaction = database.transaction(LOCK_STORE_NAME, mode);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(result);
    };
    const onAbort = () => {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed.
      }
      finish(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    transaction.oncomplete = () => finish();
    transaction.onerror = () => finish(coordinationUnavailableError());
    transaction.onabort = () =>
      finish(signal?.aborted ? abortError() : coordinationUnavailableError());
    try {
      action(transaction.objectStore(LOCK_STORE_NAME), (value) => {
        result = value;
      });
    } catch {
      finish(coordinationUnavailableError());
    }
  });
}
