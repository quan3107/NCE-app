/**
 * Location: src/features/navigation/components/NavigationProvider.tsx
 * Purpose: Compose navigation hooks and expose a shared context for consumers.
 * Why: Creates a single integration point for Phase 3 AppShell wiring.
 */

import { type ReactNode, createContext, useCallback, useContext, useMemo } from 'react';

import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { useNavigation } from '../hooks/useNavigation';
import { usePermissions } from '../hooks/usePermissions';
import type { NavigationContextValue, NavigationItem } from '../types';

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

const isFeatureEnabledForMap = (
  featureFlag: string | null | undefined,
  featureFlags: Record<string, boolean>,
): boolean => {
  if (!featureFlag) {
    return true;
  }

  return featureFlags[featureFlag] === true;
};

const filterNavigationItems = (
  items: NavigationItem[],
  hasPermission: (requiredPermission: string | null | undefined) => boolean,
  isFeatureEnabled: (featureFlag: string | null | undefined) => boolean,
): NavigationItem[] =>
  items
    .filter((item) => hasPermission(item.requiredPermission) && isFeatureEnabled(item.featureFlag))
    .map((item) => ({
      ...item,
      children: filterNavigationItems(item.children, hasPermission, isFeatureEnabled),
    }));

type NavigationProviderProps = {
  children: ReactNode;
};

export function NavigationProvider({ children }: NavigationProviderProps) {
  const navigationState = useNavigation();
  const badgeState = useBadgeCounts();
  const permissionState = usePermissions(navigationState.navigation.permissions);

  const isFeatureEnabled = useCallback(
    (featureFlag: string | null | undefined) =>
      isFeatureEnabledForMap(featureFlag, navigationState.navigation.featureFlags),
    [navigationState.navigation.featureFlags],
  );

  const filteredItems = useMemo(
    () =>
      filterNavigationItems(
        navigationState.navigation.items,
        permissionState.hasPermission,
        isFeatureEnabled,
      ),
    [isFeatureEnabled, navigationState.navigation.items, permissionState.hasPermission],
  );

  const refetch = useCallback(async () => {
    await Promise.all([navigationState.refetch(), badgeState.refetch()]);
  }, [badgeState, navigationState]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      navigation: navigationState.navigation,
      items: filteredItems,
      source: navigationState.source,
      isLoading: navigationState.isLoading || badgeState.isLoading,
      error: navigationState.error ?? badgeState.error,
      badgeCounts: badgeState.counts,
      hasPermission: permissionState.hasPermission,
      hasAnyPermission: permissionState.hasAnyPermission,
      hasAllPermissions: permissionState.hasAllPermissions,
      isFeatureEnabled,
      refetch,
    }),
    [
      badgeState.counts,
      badgeState.error,
      badgeState.isLoading,
      filteredItems,
      isFeatureEnabled,
      navigationState.error,
      navigationState.isLoading,
      navigationState.navigation,
      navigationState.source,
      permissionState.hasAllPermissions,
      permissionState.hasAnyPermission,
      permissionState.hasPermission,
      refetch,
    ],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationContext() {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }

  return context;
}
