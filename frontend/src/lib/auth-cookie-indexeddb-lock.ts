/**
 * Location: src/lib/auth-cookie-indexeddb-lock.ts
 * Purpose: Serialize auth-cookie operations when Web Locks and localStorage are unavailable.
 * Why: IndexedDB read-write transactions provide an atomic cross-tab lease boundary.
 */

const DATABASE_NAME = "nce-auth-coordination";
const DATABASE_VERSION = 1;
const LOCK_STORE_NAME = "locks";
const LOCK_NAME = "auth-cookie-operations";
const LOCK_POLL_MS = 25;
const MINIMUM_LEASE_MS = 60_000;

type LockRecord = {
  name: string;
  ownerId: string;
  expiresAt: number;
};

function abortError(): Error {
  const error = new Error("Authentication cookie operation was aborted.");
  error.name = "AbortError";
  return error;
}

function coordinationUnavailableError(): Error {
  const error = new Error(
    "Cross-tab authentication coordination is unavailable.",
  );
  error.name = "AuthCoordinationUnavailableError";
  return error;
}

function indexedDbOrNull(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      reject(coordinationUnavailableError());
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCK_STORE_NAME)) {
        request.result.createObjectStore(LOCK_STORE_NAME, {
          keyPath: "name",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(coordinationUnavailableError());
    request.onblocked = () => reject(coordinationUnavailableError());
  });
}

function tryAcquireLease(
  database: IDBDatabase,
  ownerId: string,
  leaseMs: number,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let acquired = false;
    const transaction = database.transaction(LOCK_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCK_STORE_NAME);
    const request = store.get(LOCK_NAME);

    request.onsuccess = () => {
      const current = request.result as LockRecord | undefined;
      if (current && current.expiresAt > Date.now()) {
        return;
      }
      acquired = true;
      store.put({
        name: LOCK_NAME,
        ownerId,
        expiresAt: Date.now() + Math.max(leaseMs, MINIMUM_LEASE_MS),
      } satisfies LockRecord);
    };
    transaction.oncomplete = () => resolve(acquired);
    transaction.onerror = () => reject(coordinationUnavailableError());
    transaction.onabort = () => reject(coordinationUnavailableError());
  });
}

function releaseLease(
  database: IDBDatabase,
  ownerId: string,
): Promise<void> {
  return new Promise((resolve) => {
    const transaction = database.transaction(LOCK_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCK_STORE_NAME);
    const request = store.get(LOCK_NAME);

    request.onsuccess = () => {
      const current = request.result as LockRecord | undefined;
      if (current?.ownerId === ownerId) {
        store.delete(LOCK_NAME);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, LOCK_POLL_MS);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runWithIndexedDbAuthLock<T>(
  signal: AbortSignal,
  leaseMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  const factory = indexedDbOrNull();
  if (!factory) {
    throw coordinationUnavailableError();
  }
  const database = await openDatabase(factory);
  const ownerId = crypto.randomUUID();
  try {
    while (!(await tryAcquireLease(database, ownerId, leaseMs))) {
      await delay(signal);
    }
    if (signal.aborted) {
      throw abortError();
    }
    return await operation();
  } finally {
    await releaseLease(database, ownerId);
    database.close();
  }
}
