/**
 * Location: src/lib/auth-restoration-baseline.ts
 * Purpose: Track provisional identity and role while a persisted session restores.
 * Why: Reload comparison must fence real authorization changes without authenticating storage.
 */
import { useMemo, useRef } from 'react';

import type { LiveUser, PersistSnapshot } from './auth-types';
import type { SharedAuthSnapshot } from './shared-auth-session';

type ProfileRevisionKind = 'live' | 'restoring' | null;

export function useAuthRestorationBaseline(initialUser: LiveUser | null) {
  const restoringUserRef = useRef(initialUser);

  return useMemo(() => {
    const currentUser = (liveUser: LiveUser | null) =>
      liveUser ?? restoringUserRef.current;

    return {
      classifyProfileRevision(
        snapshot: SharedAuthSnapshot,
        sessionEpoch: number,
        profileRevision: number,
        liveUser: LiveUser | null,
      ): ProfileRevisionKind {
        const user = currentUser(liveUser);
        if (
          snapshot.sessionEpoch !== sessionEpoch ||
          snapshot.profileRevision <= profileRevision ||
          snapshot.liveUser?.id !== user?.id ||
          snapshot.liveUser?.role !== user?.role
        ) {
          return null;
        }
        if (liveUser) return 'live';
        restoringUserRef.current = snapshot.liveUser;
        return 'restoring';
      },
      clear(): void {
        restoringUserRef.current = null;
      },
      previousSnapshot(
        token: string | null,
        liveUser: LiveUser | null,
      ): PersistSnapshot {
        return { token, liveUser: currentUser(liveUser) };
      },
      replacesAuthorization(
        liveUser: LiveUser | null,
        nextUser: LiveUser,
      ): boolean {
        const user = currentUser(liveUser);
        return user?.id !== nextUser.id || user?.role !== nextUser.role;
      },
      replacesIdentity(liveUser: LiveUser | null, nextUser: LiveUser): boolean {
        return currentUser(liveUser)?.id !== nextUser.id;
      },
    };
  }, []);
}
