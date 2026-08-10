/**
 * Location: src/lib/active-profile-session.ts
 * Purpose: Keep the active actor's authoritative profile observed and synchronized.
 * Why: Profile identity must survive route changes and receive peer invalidations globally.
 */

import { QueryObserver } from '@tanstack/react-query';

import {
  fetchMeProfile,
  isProfileAuthorityCurrent,
  meProfileQueryKey,
  type MeProfile,
  type ProfileAuthority,
} from '../features/profile/api';
import { ApiError } from './apiClient';
import { queryClient } from './queryClient';
import { subscribeToProfileInvalidation } from './shared-profile-invalidation';

const isTerminalProfileError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

export function startActiveProfileSession(
  authority: ProfileAuthority,
  onTerminalError: () => void,
): () => void {
  const { userId } = authority;
  const observer = new QueryObserver<MeProfile>(queryClient, {
    queryKey: meProfileQueryKey(userId),
    queryFn: async ({ signal }) => {
      if (!isProfileAuthorityCurrent(authority)) {
        throw new ApiError('Profile ownership changed before loading.', 0);
      }
      const profile = await fetchMeProfile(signal);
      if (
        !isProfileAuthorityCurrent(authority) ||
        profile.id !== authority.userId ||
        profile.role !== authority.role
      ) {
        throw new ApiError('Profile ownership changed while loading.', 0);
      }
      return profile;
    },
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
      if (
        invalidation.userId === userId &&
        isProfileAuthorityCurrent(authority)
      ) {
        void observer.refetch();
      }
    },
  );

  return () => {
    unsubscribeInvalidation();
    unsubscribeQuery();
  };
}
