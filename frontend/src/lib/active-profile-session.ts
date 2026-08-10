/**
 * Location: src/lib/active-profile-session.ts
 * Purpose: Keep the active actor's authoritative profile observed and synchronized.
 * Why: Profile identity must survive route changes and receive peer invalidations globally.
 */

import { QueryObserver } from '@tanstack/react-query';

import {
  fetchMeProfile,
  meProfileQueryKey,
  type MeProfile,
} from '../features/profile/api';
import { ApiError } from './apiClient';
import { queryClient } from './queryClient';
import { subscribeToProfileInvalidation } from './shared-profile-invalidation';

const isTerminalProfileError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

export function startActiveProfileSession(
  userId: string,
  onTerminalError: () => void,
): () => void {
  const observer = new QueryObserver<MeProfile>(queryClient, {
    queryKey: meProfileQueryKey(userId),
    queryFn: ({ signal }) => fetchMeProfile(signal),
  });
  let terminalReported = false;
  const unsubscribeQuery = observer.subscribe((result) => {
    if (
      !terminalReported &&
      result.error &&
      isTerminalProfileError(result.error)
    ) {
      terminalReported = true;
      onTerminalError();
    }
  });
  const unsubscribeInvalidation = subscribeToProfileInvalidation(
    (invalidation) => {
      if (invalidation.userId === userId) void observer.refetch();
    },
  );

  return () => {
    unsubscribeInvalidation();
    unsubscribeQuery();
  };
}
