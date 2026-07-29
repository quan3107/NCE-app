/**
 * Location: src/lib/auth-cookie-operations.ts
 * Purpose: Serialize browser requests that rotate or clear the refresh cookie.
 * Why: A late Set-Cookie response must not overwrite a newer account session.
 */

export type AuthCookieOperations = {
  run: <T>(operation: () => Promise<T>) => Promise<T>;
  runRefresh: <T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  cancelRefreshes: () => void;
};

type AuthCookieOperationOptions = {
  refreshTimeoutMs?: number;
};

const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;

function abortError(): Error {
  const error = new Error('Authentication refresh was aborted.');
  error.name = 'AbortError';
  return error;
}

export function createAuthCookieOperations(
  options: AuthCookieOperationOptions = {},
): AuthCookieOperations {
  let tail: Promise<void> = Promise.resolve();
  const refreshControllers = new Set<AbortController>();
  const refreshTimeoutMs =
    options.refreshTimeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;

  function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    run,
    runRefresh<T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      const controller = new AbortController();
      refreshControllers.add(controller);
      const timeout = setTimeout(
        () => controller.abort(),
        refreshTimeoutMs,
      );
      const result = run(async () => {
        if (controller.signal.aborted) {
          throw abortError();
        }
        return new Promise<T>((resolve, reject) => {
          const onAbort = () => {
            reject(abortError());
          };
          controller.signal.addEventListener('abort', onAbort, { once: true });
          operation(controller.signal).then(
            (value) => {
              controller.signal.removeEventListener('abort', onAbort);
              resolve(value);
            },
            (error: unknown) => {
              controller.signal.removeEventListener('abort', onAbort);
              reject(error);
            },
          );
        });
      });
      return result.finally(() => {
        clearTimeout(timeout);
        refreshControllers.delete(controller);
      });
    },
    cancelRefreshes() {
      refreshControllers.forEach((controller) => controller.abort());
    },
  };
}
