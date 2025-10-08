/**
 * Location: src/lib/useStaticQuery.ts
 * Purpose: Provide a lightweight React hook that keeps local state in sync with QueryClientStub.
 * Why: Enables components to adopt the shared data-access layer before integrating a real backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { queryClient } from '@lib/queryClient';

type Fetcher<T> = () => Promise<T> | T;

type UseStaticQueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useStaticQuery<T>(key: string, fetcher: Fetcher<T>): UseStaticQueryResult<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | undefined>(() => queryClient.getQueryData<T>(key));
  const [isLoading, setIsLoading] = useState<boolean>(() => data === undefined);
  const [error, setError] = useState<Error | null>(null);

  const runFetch = useCallback(
    async (force = false) => {
      const shouldFetch = force || queryClient.getQueryData<T>(key) === undefined;
      if (!shouldFetch && !force) {
        setData(queryClient.getQueryData<T>(key));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await queryClient.fetchQuery(
          key,
          async () => Promise.resolve(await fetcherRef.current()),
          force,
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [key],
  );

  useEffect(() => {
    let active = true;

    if (queryClient.getQueryData<T>(key) === undefined) {
      runFetch().catch(() => {
        /* error handled in state */
      });
    } else {
      setData(queryClient.getQueryData<T>(key));
      setIsLoading(false);
    }

    const unsubscribe = queryClient.subscribe(key, () => {
      if (!active) return;
      setData(queryClient.getQueryData<T>(key));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, runFetch]);

  const refresh = useCallback(async () => {
    await runFetch(true);
  }, [runFetch]);

  return { data, isLoading, error, refresh };
}
