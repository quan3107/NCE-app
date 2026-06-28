/**
 * Location: src/features/navigation/hooks/useNavigation.ts
 * Purpose: Load authenticated navigation from the backend.
 * Why: Keeps menu rendering server-sourced and surfaces navigation failures directly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@domain';
import { useAuthStore } from '@store/authStore';

import { fetchNavigationFromMe } from '../api';
import type { NavigationPayload, NavigationSource } from '../types';

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

  const isPublicNavigation = !isAuthenticated || role === 'public';
  const initialSource: NavigationSource = 'unavailable';
  const [source, setSource] = useState<NavigationSource>(initialSource);

  useEffect(() => {
    setSource(initialSource);
  }, [initialSource, role, userId]);

  const queryEnabled = !isPublicNavigation && userId.length > 0;

  const query = useQuery({
    queryKey: [NAVIGATION_QUERY_KEY, userId, role],
    queryFn: fetchNavigationFromMe,
    enabled: queryEnabled,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!queryEnabled) {
      setSource('unavailable');
      return;
    }

    if (query.isSuccess && !query.isFetching) {
      setSource('live');
      return;
    }

    if (query.isError) {
      setSource('unavailable');
    }
  }, [query.isError, query.isFetching, query.isSuccess, queryEnabled]);

  const navigation = query.isError ? EMPTY_AUTHENTICATED_NAVIGATION : query.data ?? EMPTY_AUTHENTICATED_NAVIGATION;
  const error = query.error instanceof Error ? query.error : null;

  const refetch = useCallback(async () => {
    if (!queryEnabled) {
      setSource('unavailable');
      return;
    }

    const result = await query.refetch();
    if (result.isSuccess) {
      setSource('live');
      return;
    }

    setSource('unavailable');
  }, [query, queryEnabled]);

  return {
    navigation,
    source,
    isLoading: query.isLoading || query.isFetching,
    error,
    refetch,
  };
}
