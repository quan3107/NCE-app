/**
 * Location: src/lib/auth-cookie-operations.ts
 * Purpose: Serialize browser requests that rotate or clear the refresh cookie.
 * Why: A late Set-Cookie response must not overwrite a newer account session.
 */

import {
  clearOwnedOAuthLease,
  createOAuthLease,
  hasOwnedOAuthLease,
  runWithCrossTabAuthLock,
} from './auth-cookie-coordination';

export type CookieCompensate = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
) => Promise<T>;

type CookieOperation<T> = (
  signal: AbortSignal,
  compensate: CookieCompensate,
  isSuperseded: () => boolean,
) => Promise<T>;

type CancelCookieOperation = () => void;

export type AuthCookieOperations = {
  run: <T>(operation: CookieOperation<T>) => Promise<T>;
  runRefresh: <T>(operation: CookieOperation<T>) => Promise<T>;
  runOAuthStart: <T>(operation: CookieOperation<T>) => Promise<T>;
  runOAuthCompletion: <T>(operation: CookieOperation<T>) => Promise<T>;
  releaseOAuthLease: () => Promise<void>;
  hasOwnedOAuthLease: () => boolean;
  cancelRefreshes: () => void;
  cancelOAuthCompletions: () => boolean;
};

type AuthCookieOperationOptions = {
  operationTimeoutMs?: number;
  refreshTimeoutMs?: number;
};

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;
let inRealmTail: Promise<void> = Promise.resolve();
const inRealmRefreshCancellations = new Set<CancelCookieOperation>();
const inRealmOAuthCompletionCancellations = new Set<CancelCookieOperation>();
// Once coordinated work starts, its finally block is the sole lease-cleanup owner.
const inRealmOAuthCompletionCleanupOwners = new Set<CancelCookieOperation>();

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function createAuthCookieOperations(
  options: AuthCookieOperationOptions = {},
): AuthCookieOperations {
  const operationTimeoutMs =
    options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  const refreshTimeoutMs =
    options.refreshTimeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;

  function enqueue<T>(
    operation: CookieOperation<T>,
    timeoutMs: number,
    trackedCancellations?: Set<CancelCookieOperation>,
    allowOwnedLease = false,
    prepare?: (signal: AbortSignal) => Promise<void>,
    cleanupOwners?: Set<CancelCookieOperation>,
  ): Promise<T> {
    const coordinationController = new AbortController();
    const resultController = new AbortController();
    const signal = coordinationController.signal;
    let started = false;
    let superseded = false;
    const cancel = () => {
      if (superseded) return;
      superseded = true;
      resultController.abort();
      // Once a cookie request starts, aborting fetch cannot retract server-side
      // rotation. Keep it serialized and discard only its caller/UI result.
      if (!started) coordinationController.abort();
    };
    trackedCancellations?.add(cancel);
    const deadline = Date.now() + timeoutMs;
    const timeout = setTimeout(cancel, timeoutMs);
    const queued = inRealmTail.then(async () => {
      if (signal.aborted || Date.now() >= deadline) throw abortError();
      await prepare?.(signal);
      if (signal.aborted || Date.now() >= deadline) throw abortError();
      return runWithCrossTabAuthLock(
        signal,
        allowOwnedLease,
        timeoutMs,
        (coordinatedSignal) => {
          if (Date.now() >= deadline) throw abortError();
          started = true;
          cleanupOwners?.add(cancel);
          const compensate: CookieCompensate = async (compensation) => {
            const controller = new AbortController();
            const compensationTimeout = setTimeout(
              () => controller.abort(),
              operationTimeoutMs,
            );
            try {
              return await compensation(controller.signal);
            } finally {
              clearTimeout(compensationTimeout);
            }
          };
          return operation(coordinatedSignal, compensate, () => superseded);
        },
      );
    });
    const result = abortable(queued, resultController.signal);
    // The queue follows the underlying cookie mutation, not the caller-facing
    // cancellation. This prevents a new mutation from overtaking server work.
    inRealmTail = queued.then(
      () => undefined,
      () => undefined,
    );
    const cleanup = () => {
      clearTimeout(timeout);
      trackedCancellations?.delete(cancel);
      cleanupOwners?.delete(cancel);
    };
    void queued.then(cleanup, cleanup);
    return result;
  }

  function run<T>(
    operation: CookieOperation<T>,
  ): Promise<T> {
    return enqueue(
      operation,
      operationTimeoutMs,
      undefined,
      false,
      clearOwnedOAuthLease,
    );
  }

  return {
    run,
    runRefresh<T>(
      operation: CookieOperation<T>,
    ): Promise<T> {
      return enqueue(
        operation,
        refreshTimeoutMs,
        inRealmRefreshCancellations,
      );
    },
    async runOAuthStart<T>(
      operation: CookieOperation<T>,
    ): Promise<T> {
      return enqueue(async (signal, compensate, isSuperseded) => {
        const result = await operation(signal, compensate, isSuperseded);
        if (isSuperseded()) throw abortError();
        await createOAuthLease(signal);
        return result;
      }, operationTimeoutMs);
    },
    runOAuthCompletion<T>(
      operation: CookieOperation<T>,
    ): Promise<T> {
      return enqueue(
        async (signal, compensate, isSuperseded) => {
          try {
            return await operation(signal, compensate, isSuperseded);
          } finally {
            if (signal.aborted || isSuperseded()) {
              await compensate(clearOwnedOAuthLease);
            } else {
              await clearOwnedOAuthLease(signal);
            }
          }
        },
        operationTimeoutMs,
        inRealmOAuthCompletionCancellations,
        true,
        undefined,
        inRealmOAuthCompletionCleanupOwners,
      );
    },
    releaseOAuthLease() {
      return enqueue(
        (signal) => clearOwnedOAuthLease(signal),
        operationTimeoutMs,
        undefined,
        true,
      );
    },
    hasOwnedOAuthLease() {
      return hasOwnedOAuthLease();
    },
    cancelRefreshes() {
      inRealmRefreshCancellations.forEach((cancel) => cancel());
    },
    cancelOAuthCompletions() {
      const completionOwnsCleanup =
        inRealmOAuthCompletionCleanupOwners.size > 0;
      inRealmOAuthCompletionCancellations.forEach((cancel) => cancel());
      return completionOwnsCleanup;
    },
  };
}
