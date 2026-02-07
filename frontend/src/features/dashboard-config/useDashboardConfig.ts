/**
 * Location: src/features/dashboard-config/useDashboardConfig.ts
 * Purpose: Expose dashboard config query/mutation hooks with safe fallback behavior.
 * Why: Lets dashboard routes consume backend-driven widget metadata without losing resilience.
 */

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '@lib/queryClient';
import { useAuthStore } from '@store/authStore';

import {
  fetchDashboardWidgetDefaults,
  fetchMyDashboardConfig,
  resetMyDashboardConfig,
  saveMyDashboardConfig,
} from './api';
import { getFallbackDashboardConfig } from './fallback';
import type {
  DashboardRole,
  MyDashboardConfigResponse,
  UpdateMyDashboardConfigRequest,
} from './types';

const DASHBOARD_CONFIG_KEY = 'dashboard-config:me';
const DASHBOARD_DEFAULTS_KEY = 'dashboard-config:defaults';

const toDashboardRole = (role: string): DashboardRole | null => {
  if (role === 'student' || role === 'teacher' || role === 'admin') {
    return role;
  }

  return null;
};

export function useDashboardWidgetDefaultsQuery() {
  const { currentUser } = useAuthStore();
  const role = toDashboardRole(currentUser.role);

  return useQuery({
    queryKey: [DASHBOARD_DEFAULTS_KEY, role ?? 'none'],
    queryFn: () => {
      if (!role) {
        throw new Error('Dashboard widget defaults are unavailable for this role.');
      }

      return fetchDashboardWidgetDefaults(role);
    },
    enabled: Boolean(role),
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardConfig() {
  const { currentUser, isAuthenticated } = useAuthStore();
  const role = toDashboardRole(currentUser.role);

  const fallbackConfig = useMemo<MyDashboardConfigResponse | null>(() => {
    if (!role) {
      return null;
    }

    return getFallbackDashboardConfig(role);
  }, [role]);

  const queryKey = [DASHBOARD_CONFIG_KEY, currentUser.id || 'anonymous', role ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!role) {
        throw new Error('Dashboard configuration is unavailable for this role.');
      }

      return fetchMyDashboardConfig();
    },
    enabled: isAuthenticated && Boolean(role) && currentUser.id.length > 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateMyDashboardConfigRequest) => saveMyDashboardConfig(payload),
    onSuccess: (payload) => {
      queryClient.setQueryData(queryKey, payload);
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_DEFAULTS_KEY] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetMyDashboardConfig(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await query.refetch();
    },
  });

  const config = query.data ?? fallbackConfig;

  return {
    config,
    source: query.data ? 'live' : 'fallback',
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
    saveConfig: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    resetConfig: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
