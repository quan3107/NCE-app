/**
 * Location: src/features/navigation/index.ts
 * Purpose: Export the navigation module surface from a single entry point.
 * Why: Simplifies imports during Phase 3 integration.
 */

export * from './api';
export * from './types';
export * from './utils/cache';
export * from './utils/fallbackNav';
export * from './utils/iconMap';
export * from './hooks/useNavigation';
export * from './hooks/useBadgeCounts';
export * from './hooks/usePermissions';
export * from './components/NavigationProvider';
export * from './components/NavigationBadge';
export { NavigationItem as NavigationItemRow } from './components/NavigationItem';
