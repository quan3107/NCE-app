/**
 * Location: src/features/navigation/hooks/useNavigation.ts
 * Purpose: Load navigation with cache-first behavior and resilient fallback handling.
 * Why: Keeps menu rendering responsive even during transient backend failures.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@domain';
import { useAuthStore } from '@store/authStore';

import { fetchNavigationFromMe } from '../api';
import type { NavigationPayload, NavigationSource } from '../types';
import { getFallbackNavigation } from '../utils/fallbackNav';
import { readNavigationCache, writeNavigationCache } from '../utils/cache';

const NAVIGATION_QUERY_KEY = 'navigation:me';
const EMPTY_AUTHENTICATED_NAVIGATION: NavigationPayload = {
  items: [],
  permissions: [],
  featureFlags: {},
  version: 'unavailable',
};

export function useNavigation() {
  const { currentUser, isAuthenticated } = useAuthStore();

  const role = useMemo<Role>(() => {
    if (!isAuthenticated) {
      return 'public';
    }

    switch (currentUser.role) {
      case 'student':
      case 'teacher':
      case 'admin':
        return currentUser.role;
      default:
        return 'public';
    }
  }, [currentUser.role, isAuthenticated]);
  const userId = currentUser.id || 'public';

  const cacheIdentity = useMemo(
    () => ({
      userId,
      role,
    }),
    [role, userId],
  );

  const isPublicNavigation = !isAuthenticated || role === 'public';
  const fallbackNavigation = useMemo<NavigationPayload>(() => getFallbackNavigation(), []);
  const cachedNavigation = useMemo<NavigationPayload | null>(
    () => readNavigationCache(cacheIdentity),
    [cacheIdentity],
  );
  const initialNavigation = cachedNavigation ?? (isPublicNavigation ? fallbackNavigation : undefined);

  const initialSource: NavigationSource = cachedNavigation
    ? 'cache'
    : isPublicNavigation
      ? 'fallback'
      : 'unavailable';
  const [source, setSource] = useState<NavigationSource>(initialSource);

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource, role, userId]);

  const queryEnabled = !isPublicNavigation && userId.length > 0;

  const query = useQuery({
    queryKey: [NAVIGATION_QUERY_KEY, userId, role],
    queryFn: async () => {
      const payload = await fetchNavigationFromMe();
      writeNavigationCache(cacheIdentity, payload);
      return payload;
    },
    enabled: queryEnabled,
    initialData: initialNavigation,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const failedSource: NavigationSource = cachedNavigation
    ? 'cache'
    : query.data
      ? 'live'
      : 'unavailable';

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
      setSource(failedSource);
    }
  }, [failedSource, query.isError, query.isFetching, query.isSuccess, queryEnabled]);

  const navigation =
    query.data ??
    cachedNavigation ??
    (isPublicNavigation ? fallbackNavigation : EMPTY_AUTHENTICATED_NAVIGATION);
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

    setSource(failedSource);
  }, [failedSource, query, queryEnabled]);

  return {
    navigation,
    source,
    isLoading: query.isLoading || query.isFetching,
    error,
    refetch,
  };
}
