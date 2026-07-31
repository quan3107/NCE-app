/**
 * Location: src/lib/auth-query-session.ts
 * Purpose: Synchronize and clear query data when authentication changes.
 * Why: Auth session transitions must invalidate every actor-scoped cache.
 */

import type { LiveUser } from './auth-types';
import { queryClient } from './queryClient';

export function synchronizeProfileCache(user: LiveUser): void {
  const queryKey = ['identity', user.id, 'profile'] as const;
  void queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueriesData({ queryKey, exact: true }, (cached: unknown) => {
    if (
      !cached ||
      typeof cached !== 'object' ||
      !('id' in cached) ||
      cached.id !== user.id
    ) {
      return cached;
    }
    return {
      ...cached,
      email: user.email,
      fullName: user.name,
      role: user.role,
    };
  });
}

export function clearAuthenticatedQueries(): void {
  queryClient.clear();
}
