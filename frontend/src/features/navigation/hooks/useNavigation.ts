/**
 * Location: src/features/navigation/hooks/useNavigation.ts
 * Purpose: Load navigation with cache-first behavior and resilient fallback handling.
 * Why: Keeps menu rendering responsive even during transient backend failures.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore';

import { fetchNavigationFromMe } from '../api';
import type { NavigationPayload, NavigationSource } from '../types';
import { getFallbackNavigation } from '../utils/fallbackNav';
import { readNavigationCache, writeNavigationCache } from '../utils/cache';

const NAVIGATION_QUERY_KEY = 'navigation:me';

export function useNavigation() {
  const { currentUser, isAuthenticated } = useAuthStore();

  const role = isAuthenticated && currentUser.role !== 'public' ? currentUser.role : 'public';
  const userId = currentUser.id || 'public';

  const cacheIdentity = useMemo(
    () => ({
      userId,
      role,
    }),
    [role, userId],
  );

  const fallbackNavigation = useMemo<NavigationPayload>(() => getFallbackNavigation(role), [role]);
  const cachedNavigation = useMemo<NavigationPayload | null>(
    () => readNavigationCache(cacheIdentity),
    [cacheIdentity],
  );

  const initialSource: NavigationSource = cachedNavigation ? 'cache' : 'fallback';
  const [source, setSource] = useState<NavigationSource>(initialSource);

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource, role, userId]);

  const queryEnabled = isAuthenticated && role !== 'public' && userId.length > 0;

  const query = useQuery({
    queryKey: [NAVIGATION_QUERY_KEY, userId, role],
    queryFn: async () => {
      const payload = await fetchNavigationFromMe();
      writeNavigationCache(cacheIdentity, payload);
      return payload;
    },
    enabled: queryEnabled,
    initialData: cachedNavigation ?? fallbackNavigation,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!queryEnabled) {
      setSource('fallback');
      return;
    }

    if (query.isSuccess && !query.isFetching) {
      setSource('live');
      return;
    }

    if (query.isError) {
      setSource(cachedNavigation ? 'cache' : 'fallback');
    }
  }, [cachedNavigation, query.isError, query.isFetching, query.isSuccess, queryEnabled]);

  const navigation = query.data ?? cachedNavigation ?? fallbackNavigation;
  const error = query.error instanceof Error ? query.error : null;

  const refetch = useCallback(async () => {
    if (!queryEnabled) {
      setSource('fallback');
      return;
    }

    const result = await query.refetch();
    if (result.isSuccess) {
      setSource('live');
      return;
    }

    setSource(cachedNavigation ? 'cache' : 'fallback');
  }, [cachedNavigation, query, queryEnabled]);

  return {
    navigation,
    source,
    isLoading: query.isLoading || query.isFetching,
    error,
    refetch,
  };
}
