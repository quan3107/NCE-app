/**
 * Location: src/lib/auth-cookie-operations.ts
 * Purpose: Serialize browser requests that rotate or clear the refresh cookie.
 * Why: A late Set-Cookie response must not overwrite a newer account session.
 */

export type AuthCookieOperations = {
  run: <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  runRefresh: <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  runOAuthStart: <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  runOAuthCompletion: <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  hasOwnedOAuthLease: () => boolean;
  cancelRefreshes: () => void;
};

type AuthCookieOperationOptions = {
  operationTimeoutMs?: number;
  refreshTimeoutMs?: number;
};

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;
const AUTH_COOKIE_LOCK_NAME = 'nce-auth-cookie-operations';
const OAUTH_LEASE_KEY = 'nce:auth-cookie-oauth-lease';
const OAUTH_LEASE_OWNER_KEY = 'nce:auth-cookie-oauth-owner';
const OAUTH_LEASE_MS = 5 * 60 * 1000;
const LEASE_POLL_MS = 50;
let inRealmTail: Promise<void> = Promise.resolve();
const inRealmRefreshControllers = new Set<AbortController>();

type OAuthLease = {
  ownerId: string;
  expiresAt: number;
};

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function readOAuthLease(): OAuthLease | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(OAUTH_LEASE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<OAuthLease>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(OAUTH_LEASE_KEY);
      return null;
    }
    return parsed as OAuthLease;
  } catch {
    return null;
  }
}

function ownedOAuthLeaseId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage.getItem(OAUTH_LEASE_OWNER_KEY);
  } catch {
    return null;
  }
}

function createOAuthLease(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const ownerId = crypto.randomUUID();
  window.sessionStorage.setItem(OAUTH_LEASE_OWNER_KEY, ownerId);
  window.localStorage.setItem(
    OAUTH_LEASE_KEY,
    JSON.stringify({ ownerId, expiresAt: Date.now() + OAUTH_LEASE_MS }),
  );
}

function clearOwnedOAuthLease(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const ownerId = ownedOAuthLeaseId();
  if (readOAuthLease()?.ownerId === ownerId) {
    window.localStorage.removeItem(OAUTH_LEASE_KEY);
  }
  window.sessionStorage.removeItem(OAUTH_LEASE_OWNER_KEY);
}

function delayUntilLeaseChanges(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, LEASE_POLL_MS);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitForAvailableLease(
  signal: AbortSignal,
  allowOwnedLease: boolean,
): Promise<void> {
  while (true) {
    const lease = readOAuthLease();
    if (
      !lease ||
      (allowOwnedLease && lease.ownerId === ownedOAuthLeaseId())
    ) {
      return;
    }
    await delayUntilLeaseChanges(signal);
  }
}

async function withCrossTabLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  operation: () => Promise<T>,
): Promise<T> {
  await waitForAvailableLease(signal, allowOwnedLease);
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return operation();
  }
  return navigator.locks.request(
    AUTH_COOKIE_LOCK_NAME,
    { mode: 'exclusive', signal },
    async () => {
      await waitForAvailableLease(signal, allowOwnedLease);
      return operation();
    },
  );
}

export function createAuthCookieOperations(
  options: AuthCookieOperationOptions = {},
): AuthCookieOperations {
  const operationTimeoutMs =
    options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  const refreshTimeoutMs =
    options.refreshTimeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;

  function enqueue<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    trackedControllers?: Set<AbortController>,
    allowOwnedLease = false,
  ): Promise<T> {
    const controller = new AbortController();
    trackedControllers?.add(controller);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = inRealmTail.then(async () => {
      if (controller.signal.aborted) {
        throw abortError();
      }
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      return withCrossTabLock(controller.signal, allowOwnedLease, () =>
        new Promise<T>((resolve, reject) => {
          const onAbort = () => reject(abortError());
          controller.signal.addEventListener('abort', onAbort, { once: true });
          Promise.resolve()
            .then(() => operation(controller.signal))
            .then(resolve, reject)
            .finally(() => {
              controller.signal.removeEventListener('abort', onAbort);
            });
        }),
      );
    });
    inRealmTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
      trackedControllers?.delete(controller);
    });
  }

  function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return enqueue(operation, operationTimeoutMs);
  }

  return {
    run,
    runRefresh<T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      return enqueue(
        operation,
        refreshTimeoutMs,
        inRealmRefreshControllers,
      );
    },
    async runOAuthStart<T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      return enqueue(async (signal) => {
        const result = await operation(signal);
        createOAuthLease();
        return result;
      }, operationTimeoutMs);
    },
    runOAuthCompletion<T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      return enqueue(operation, operationTimeoutMs, undefined, true).finally(
        clearOwnedOAuthLease,
      );
    },
    hasOwnedOAuthLease() {
      const ownerId = ownedOAuthLeaseId();
      return Boolean(ownerId && readOAuthLease()?.ownerId === ownerId);
    },
    cancelRefreshes() {
      inRealmRefreshControllers.forEach((controller) => controller.abort());
    },
  };
}
