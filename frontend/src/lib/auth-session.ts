/**
 * Location: src/lib/auth-session.ts
 * Purpose: Apply actor-scoped query-cache rules around auth transitions.
 * Why: Account and role changes isolate data while same-actor refresh preserves it.
 */

import { notifyManager } from '@tanstack/react-query';
import type { AuthMachineState } from './auth-machine';
import type { BackendAuthUser, CurrentProfile, LiveUser } from './auth-types';
import { setAuthenticatedQueryScope } from './authenticated-query-scope';
import { queryClient } from './queryClient';

export const profileQueryKey = (userId: string) =>
  ['identity', userId, 'profile'] as const;

export function backendUserToLiveUser(user: BackendAuthUser): LiveUser {
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
  };
}

export function enterActorScope(
  previous: AuthMachineState,
  next: AuthMachineState,
): boolean {
  const previousActor =
    previous.status === 'authenticated' ? previous.actor : null;
  const nextActor = next.status === 'authenticated' ? next.actor : null;
  const replaced =
    previousActor?.id !== nextActor?.id || previousActor?.role !== nextActor?.role;
  if (!replaced) return false;
  queryClient.clear();
  setAuthenticatedQueryScope({
    generation: next.revision,
    userId: nextActor?.id ?? null,
  });
  return true;
}

export function profileFromCache(userId: string): CurrentProfile | undefined {
  return queryClient.getQueryData<CurrentProfile>(profileQueryKey(userId));
}

export function subscribeToProfileCache(userId: string, listener: () => void): () => void {
  let active = true;
  // Query creation can emit during route rendering. Match React Query's deferred
  // observer delivery so the auth provider is never updated inside that render.
  const notify = notifyManager.batchCalls(() => {
    if (active) listener();
  });
  const unsubscribe = queryClient.getQueryCache().subscribe(event => {
    const key = event.query.queryKey;
    if (key[0] === 'identity' && key[1] === userId && key[2] === 'profile') {
      notify();
    }
  });
  return () => {
    active = false;
    unsubscribe();
  };
}
