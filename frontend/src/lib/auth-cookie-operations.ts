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
  cancelRefreshes: () => void;
};

type AuthCookieOperationOptions = {
  operationTimeoutMs?: number;
  refreshTimeoutMs?: number;
};

const DEFAULT_OPERATION_TIMEOUT_MS = 10_000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function createAuthCookieOperations(
  options: AuthCookieOperationOptions = {},
): AuthCookieOperations {
  let tail: Promise<void> = Promise.resolve();
  const refreshControllers = new Set<AbortController>();
  const operationTimeoutMs =
    options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
  const refreshTimeoutMs =
    options.refreshTimeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;

  function enqueue<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    trackedControllers?: Set<AbortController>,
  ): Promise<T> {
    const controller = new AbortController();
    trackedControllers?.add(controller);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = tail.then(async () => {
      if (controller.signal.aborted) {
        throw abortError();
      }
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(abortError());
        controller.signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve()
          .then(() => operation(controller.signal))
          .then(resolve, reject)
          .finally(() => {
            controller.signal.removeEventListener('abort', onAbort);
          });
      });
    });
    tail = result.then(
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
      return enqueue(operation, refreshTimeoutMs, refreshControllers);
    },
    cancelRefreshes() {
      refreshControllers.forEach((controller) => controller.abort());
    },
  };
}
