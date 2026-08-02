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
  releaseOAuthLease: () => Promise<void>;
  hasOwnedOAuthLease: () => boolean;
  cancelRefreshes: () => void;
  cancelOAuthCompletions: () => void;
};

type AuthCookieOperationOptions = {
  operationTimeoutMs?: number;
  refreshTimeoutMs?: number;
};

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;
let inRealmTail: Promise<void> = Promise.resolve();
const inRealmRefreshControllers = new Set<AbortController>();
const inRealmOAuthCompletionControllers = new Set<AbortController>();

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
    promise.then(resolve, reject).finally(() =>
      signal.removeEventListener('abort', onAbort),
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
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    trackedControllers?: Set<AbortController>,
    allowOwnedLease = false,
    prepare?: (signal: AbortSignal) => Promise<void>,
  ): Promise<T> {
    const cancellationController = new AbortController();
    trackedControllers?.add(cancellationController);
    const signal = cancellationController.signal;
    const deadline = Date.now() + timeoutMs;
    const timeout = setTimeout(() => cancellationController.abort(), timeoutMs);
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
          return operation(coordinatedSignal);
        },
      );
    });
    const result = abortable(queued, signal);
    inRealmTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      clearTimeout(timeout);
      trackedControllers?.delete(cancellationController);
    });
  }

  function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
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
        await createOAuthLease(signal);
        return result;
      }, operationTimeoutMs);
    },
    runOAuthCompletion<T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      return enqueue(async (signal) => {
        try {
          return await operation(signal);
        } finally {
          await clearOwnedOAuthLease(signal);
        }
      }, operationTimeoutMs, inRealmOAuthCompletionControllers, true);
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
      inRealmRefreshControllers.forEach((controller) => controller.abort());
    },
    cancelOAuthCompletions() {
      inRealmOAuthCompletionControllers.forEach((controller) =>
        controller.abort(),
      );
    },
  };
}
