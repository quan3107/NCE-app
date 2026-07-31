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
};

type AuthCookieOperationOptions = {
  operationTimeoutMs?: number;
  refreshTimeoutMs?: number;
};

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;
let inRealmTail: Promise<void> = Promise.resolve();
const inRealmRefreshControllers = new Set<AbortController>();

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
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
    const cancellationController = new AbortController();
    trackedControllers?.add(cancellationController);

    const runNetworkOperation = (): Promise<T> => {
      const networkController = new AbortController();
      const cancelNetwork = () => networkController.abort();
      if (cancellationController.signal.aborted) {
        cancelNetwork();
      } else {
        cancellationController.signal.addEventListener('abort', cancelNetwork, {
          once: true,
        });
      }
      const timeout = setTimeout(cancelNetwork, timeoutMs);

      return new Promise<T>((resolve, reject) => {
        if (networkController.signal.aborted) {
          reject(abortError());
          return;
        }
        const onAbort = () => reject(abortError());
        networkController.signal.addEventListener('abort', onAbort, {
          once: true,
        });
        Promise.resolve()
          .then(() => operation(networkController.signal))
          .then(resolve, reject)
          .finally(() => {
            networkController.signal.removeEventListener('abort', onAbort);
          });
      }).finally(() => {
        clearTimeout(timeout);
        cancellationController.signal.removeEventListener(
          'abort',
          cancelNetwork,
        );
      });
    };

    const result = inRealmTail.then(async () => {
      if (cancellationController.signal.aborted) {
        throw abortError();
      }
      return runWithCrossTabAuthLock(
        cancellationController.signal,
        allowOwnedLease,
        timeoutMs + 1_000,
        runNetworkOperation,
      );
    });
    inRealmTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      trackedControllers?.delete(cancellationController);
    });
  }

  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    await clearOwnedOAuthLease();
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
        await createOAuthLease();
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
    releaseOAuthLease() {
      return clearOwnedOAuthLease();
    },
    hasOwnedOAuthLease() {
      return hasOwnedOAuthLease();
    },
    cancelRefreshes() {
      inRealmRefreshControllers.forEach((controller) => controller.abort());
    },
  };
}
