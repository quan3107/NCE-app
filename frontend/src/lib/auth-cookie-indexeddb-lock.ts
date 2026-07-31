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

export type AuthCoordinationLease = {
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
      const current = request.result as AuthCoordinationLease | undefined;
      if (current && current.expiresAt > Date.now()) {
        return;
      }
      acquired = true;
      store.put({
        name: LOCK_NAME,
        ownerId,
        expiresAt: Date.now() + Math.max(leaseMs, MINIMUM_LEASE_MS),
      } satisfies AuthCoordinationLease);
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
      const current = request.result as AuthCoordinationLease | undefined;
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

function readLease(
  database: IDBDatabase,
  name: string,
): Promise<AuthCoordinationLease | null> {
  return new Promise((resolve, reject) => {
    let lease: AuthCoordinationLease | null = null;
    const transaction = database.transaction(LOCK_STORE_NAME, "readonly");
    const request = transaction.objectStore(LOCK_STORE_NAME).get(name);

    request.onsuccess = () => {
      const stored = request.result as AuthCoordinationLease | undefined;
      lease = stored && stored.expiresAt > Date.now() ? stored : null;
    };
    transaction.oncomplete = () => resolve(lease);
    transaction.onerror = () => reject(coordinationUnavailableError());
    transaction.onabort = () => reject(coordinationUnavailableError());
  });
}

function writeLease(
  database: IDBDatabase,
  lease: AuthCoordinationLease,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCK_STORE_NAME, "readwrite");
    transaction.objectStore(LOCK_STORE_NAME).put(lease);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(coordinationUnavailableError());
    transaction.onabort = () => reject(coordinationUnavailableError());
  });
}

function removeLease(
  database: IDBDatabase,
  name: string,
  ownerId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCK_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCK_STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => {
      const stored = request.result as AuthCoordinationLease | undefined;
      if (stored?.ownerId === ownerId) {
        store.delete(name);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(coordinationUnavailableError());
    transaction.onabort = () => reject(coordinationUnavailableError());
  });
}

async function withDatabase<T>(
  operation: (database: IDBDatabase) => Promise<T>,
): Promise<T> {
  const factory = indexedDbOrNull();
  if (!factory) {
    throw coordinationUnavailableError();
  }
  const database = await openDatabase(factory);
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

export function readIndexedDbAuthLease(
  name: string,
): Promise<AuthCoordinationLease | null> {
  return withDatabase((database) => readLease(database, name));
}

export function writeIndexedDbAuthLease(
  lease: AuthCoordinationLease,
): Promise<void> {
  return withDatabase((database) => writeLease(database, lease));
}

export function removeIndexedDbAuthLease(
  name: string,
  ownerId: string,
): Promise<void> {
  return withDatabase((database) =>
    removeLease(database, name, ownerId),
  );
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
