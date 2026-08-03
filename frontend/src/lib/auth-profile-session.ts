/**
 * Location: src/lib/auth-profile-session.ts
 * Purpose: Commit authoritative profile responses into the active auth session.
 * Why: Profile ordering and cache synchronization are separate from token lifecycle work.
 */

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { apiClient } from './apiClient';
import type {
  CurrentProfile,
  LiveUser,
  PersistSnapshot,
  SessionIdentity,
} from './auth-types';
import { queryClient } from './queryClient';
import {
  publishProfileInvalidation,
  subscribeToProfileInvalidation,
} from './shared-profile-invalidation';

type ProfileSessionContext = {
  clearSession: () => void;
  liveUserRef: MutableRefObject<LiveUser | null>;
  persistProfileState: (snapshot: PersistSnapshot) => boolean;
  profileCommitSequenceRef: MutableRefObject<Map<string, number>>;
  sessionEpochRef: MutableRefObject<number>;
  sessionGenerationRef: MutableRefObject<number>;
  setLiveUser: Dispatch<SetStateAction<LiveUser | null>>;
  tokenRef: MutableRefObject<string | null>;
  userRevisionRef: MutableRefObject<number>;
};

export function useAuthProfileSession({
  clearSession,
  liveUserRef,
  persistProfileState,
  profileCommitSequenceRef,
  sessionEpochRef,
  sessionGenerationRef,
  setLiveUser,
  tokenRef,
  userRevisionRef,
}: ProfileSessionContext) {
  const refreshSequenceRef = useRef(0);
  const commitLiveProfile = useCallback(
    async (
      expected: SessionIdentity,
      profile: CurrentProfile,
    ): Promise<boolean> => {
      const currentAtStart = liveUserRef.current;
      if (
        !currentAtStart ||
        currentAtStart.id !== expected.userId ||
        profile.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return false;
      }
      if (profile.role !== currentAtStart.role || profile.status !== 'active') {
        clearSession();
        return false;
      }

      const sequenceKey = `${expected.generation}:${expected.userId}`;
      const commitSequence =
        (profileCommitSequenceRef.current.get(sequenceKey) ?? 0) + 1;
      profileCommitSequenceRef.current.set(sequenceKey, commitSequence);
      const queryKey = ['identity', expected.userId, 'profile'] as const;
      await queryClient.cancelQueries({ queryKey, exact: true });

      const current = liveUserRef.current;
      if (
        commitSequence !== profileCommitSequenceRef.current.get(sequenceKey) ||
        !current ||
        current.id !== expected.userId ||
        profile.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return false;
      }

      const nextUser = {
        ...current,
        name: profile.fullName,
        email: profile.email,
        role: profile.role,
      };
      const identityChanged =
        nextUser.name !== current.name ||
        nextUser.email !== current.email ||
        nextUser.role !== current.role;
      if (!persistProfileState({ token: tokenRef.current, liveUser: nextUser })) {
        return false;
      }
      queryClient.setQueryData(queryKey, profile);
      if (identityChanged) {
        userRevisionRef.current += 1;
        liveUserRef.current = nextUser;
        setLiveUser(nextUser);
      }
      return true;
    },
    [clearSession, persistProfileState],
  );

  const refreshLiveProfile = useCallback(
    async (
      expected: SessionIdentity,
      announce = true,
    ): Promise<CurrentProfile | null> => {
      const current = liveUserRef.current;
      if (
        !current ||
        current.id !== expected.userId ||
        sessionGenerationRef.current !== expected.generation
      ) {
        return null;
      }
      const refreshSequence = refreshSequenceRef.current + 1;
      refreshSequenceRef.current = refreshSequence;
      if (announce) {
        publishProfileInvalidation({
          userId: expected.userId,
          sessionEpoch: sessionEpochRef.current,
        });
      }
      const response = await apiClient<{ profile: CurrentProfile }>(
        '/api/v1/me',
      );
      if (
        refreshSequence !== refreshSequenceRef.current ||
        !(await commitLiveProfile(expected, response.profile))
      ) {
        return null;
      }
      return response.profile;
    },
    [commitLiveProfile],
  );

  useEffect(
    () =>
      subscribeToProfileInvalidation((invalidation) => {
        const current = liveUserRef.current;
        if (
          !current ||
          current.id !== invalidation.userId ||
          sessionEpochRef.current !== invalidation.sessionEpoch
        ) {
          return;
        }
        void refreshLiveProfile(
          {
            userId: current.id,
            generation: sessionGenerationRef.current,
          },
          false,
        ).catch(() => undefined);
      }),
    [refreshLiveProfile],
  );

  return { commitLiveProfile, refreshLiveProfile };
}
