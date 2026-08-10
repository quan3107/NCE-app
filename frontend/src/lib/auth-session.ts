/**
 * Location: src/lib/auth-session.ts
 * Purpose: Apply actor-scoped query-cache rules around auth transitions.
 * Why: Account and role changes isolate data while same-actor refresh preserves it.
 */

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

export function seedProfileForNewActor(user: BackendAuthUser): void {
  const key = profileQueryKey(user.id);
  if (queryClient.getQueryData(key) !== undefined) return;
  const profile: CurrentProfile = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: 'active',
  };
  queryClient.setQueryData(key, profile);
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
