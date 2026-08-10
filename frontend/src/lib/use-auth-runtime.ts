/**
 * Location: src/lib/use-auth-runtime.ts
 * Purpose: Bind the auth coordinator to cookie operations, React, and tab invalidations.
 * Why: One runtime must own bootstrap, refresh single-flight, transitions, and cancellation.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { apiClient } from './apiClient';
import { startActiveProfileSession } from './active-profile-session';
import { AuthCoordinator } from './auth-coordinator';
import type { AuthMachineState } from './auth-machine';
import { authBridge } from './authBridge';
import {
  createAuthCookieOperations,
  type AuthCookieOperations,
  type CookieCompensate,
} from './auth-cookie-operations';
import {
  backendUserToLiveUser,
  enterActorScope,
  profileFromCache,
  seedProfileForNewActor,
} from './auth-session';
import type {
  AuthSuccessResponse,
  LiveUser,
  RefreshAccessTokenResult,
} from './auth-types';
import { queryClient } from './queryClient';
import {
  publishAuthInvalidation,
  removeLegacyAuthSnapshot,
  subscribeToAuthInvalidation,
  type AuthInvalidationReason,
} from './shared-auth-session';

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const actorId = (state: AuthMachineState): string | null =>
  state.status === 'authenticated' ? state.actor.id : null;

const revokeRotatedCookie = (compensate: CookieCompensate): Promise<unknown> =>
  compensate((signal) =>
    apiClient('/auth/logout', {
      auth: 'none',
      method: 'POST',
      credentials: 'include',
      parseJson: false,
      signal,
    }),
  );

export function useAuthRuntime() {
  const coordinator = useMemo(() => new AuthCoordinator(), []);
  const cookieOperations = useMemo(createAuthCookieOperations, []);
  const [snapshot, setSnapshot] = useState(coordinator.getSnapshot());
  const [fallbackUser, setFallbackUser] = useState<LiveUser | null>(null);
  const activeUserId =
    snapshot.status === 'authenticated' ? snapshot.actor.id : '';

  const applyLiveSession = useCallback(
    (
      payload: AuthSuccessResponse,
      expected: AuthMachineState,
      sameActorRefresh = false,
      announce = true,
    ): boolean => {
      const current = coordinator.getSnapshot();
      if (
        current.revision !== expected.revision ||
        actorId(current) !== actorId(expected)
      ) {
        return false;
      }
      const user = backendUserToLiveUser(payload.user);
      const sameActor =
        current.status === 'authenticated' &&
        current.actor.id === user.id &&
        current.actor.role === user.role;
      if (sameActor && sameActorRefresh) {
        if (!coordinator.replaceToken(current.revision, user.id, payload.accessToken)) {
          return false;
        }
        setFallbackUser((previous) => previous ?? user);
        return true;
      }
      coordinator.authenticate(payload.accessToken, {
        id: user.id,
        role: payload.user.role,
      });
      const next = coordinator.getSnapshot();
      enterActorScope(current, next);
      seedProfileForNewActor(payload.user);
      setFallbackUser(user);
      if (announce) {
        const previousRole =
          current.status === 'authenticated' ? current.actor.role : null;
        publishAuthInvalidation(
          previousRole && previousRole !== user.role
            ? 'role-change'
            : 'account-change',
        );
      }
      return true;
    },
    [coordinator],
  );

  const clearSession = useCallback(
    (reason?: AuthInvalidationReason) => {
      const previous = coordinator.getSnapshot();
      coordinator.clear();
      enterActorScope(previous, coordinator.getSnapshot());
      setFallbackUser(null);
      if (reason) publishAuthInvalidation(reason);
    },
    [coordinator],
  );

  const refreshWith = useCallback(
    async (
      runner: AuthCookieOperations['runRefresh'],
      announce = false,
    ): Promise<RefreshAccessTokenResult> => {
      const expected = coordinator.getSnapshot();
      try {
        return await runner(async (signal, compensate) => {
          const payload = await apiClient<AuthSuccessResponse>('/auth/refresh', {
            auth: 'none',
            method: 'POST',
            credentials: 'include',
            signal,
          });
          if (
            signal.aborted ||
            !applyLiveSession(payload, expected, true, announce)
          ) {
            await revokeRotatedCookie(compensate);
            return { status: 'stale' };
          }
          return { status: 'refreshed', accessToken: payload.accessToken };
        });
      } catch (error) {
        const current = coordinator.getSnapshot();
        if (
          isAbortError(error) ||
          current.revision !== expected.revision ||
          actorId(current) !== actorId(expected)
        ) {
          return { status: 'stale' };
        }
        clearSession();
        return { status: 'failed' };
      } finally {
        if (coordinator.getSnapshot().status === 'booting') {
          coordinator.finishBootstrap();
        }
      }
    },
    [applyLiveSession, clearSession, coordinator],
  );

  const refreshHandler = useCallback(
    () => refreshWith(cookieOperations.runRefresh, false),
    [cookieOperations, refreshWith],
  );
  coordinator.setRefreshHandler(refreshHandler);

  const restoreLiveSession = useCallback(async (): Promise<boolean> => {
    const result = await coordinator.refresh();
    return result.status === 'refreshed';
  }, [coordinator]);

  const completeOAuthSession = useCallback(
    () => refreshWith(cookieOperations.runOAuthCompletion, true),
    [cookieOperations, refreshWith],
  );

  authBridge.configure({
    refreshAccessToken: () => coordinator.refresh(),
    waitUntilReady: () => coordinator.waitUntilReady(),
    admit: (mode) => coordinator.admit(mode),
    isCurrent: (admission) => coordinator.isCurrent(admission),
    getSnapshot: () => coordinator.getSnapshot(),
  });

  useEffect(() => coordinator.subscribe(setSnapshot), [coordinator]);

  useEffect(() => {
    if (!activeUserId) return;
    return startActiveProfileSession(activeUserId, () => {
      cookieOperations.cancelRefreshes();
      clearSession('logout');
      void cookieOperations
        .run((signal) =>
          apiClient('/auth/logout', {
            auth: 'none',
            method: 'POST',
            credentials: 'include',
            parseJson: false,
            signal,
          }),
        )
        .catch(() => undefined);
    });
  }, [activeUserId, clearSession, cookieOperations]);

  useEffect(() => {
    let mounted = true;
    const revalidate = async (reason: AuthInvalidationReason) => {
      if (!mounted) return;
      cookieOperations.cancelRefreshes();
      clearSession();
      if (reason === 'logout') return;
      await coordinator.refresh();
    };
    // Subscription performs its catch-up read before bootstrap starts.
    const unsubscribe = subscribeToAuthInvalidation((invalidation) =>
      void revalidate(invalidation.reason),
    );
    removeLegacyAuthSnapshot();
    const initialize = async () => {
      if (window.location.pathname === '/auth/oauth') {
        coordinator.finishBootstrap();
        return;
      }
      if (cookieOperations.hasOwnedOAuthLease()) {
        await cookieOperations.releaseOAuthLease().catch(() => undefined);
      }
      await coordinator.refresh();
    };
    void initialize();
    const onPageShow = () => void initialize();
    window.addEventListener('pageshow', onPageShow);
    return () => {
      mounted = false;
      window.removeEventListener('pageshow', onPageShow);
      unsubscribe();
      cookieOperations.cancelRefreshes();
      cookieOperations.cancelOAuthCompletions();
      authBridge.reset();
    };
  }, [clearSession, cookieOperations, coordinator]);

  const subscribeToProfile = useCallback(
    (listener: () => void) => queryClient.getQueryCache().subscribe(listener),
    [],
  );
  const readProfile = useCallback(
    () => (activeUserId ? profileFromCache(activeUserId) : undefined),
    [activeUserId],
  );
  const profile = useSyncExternalStore(
    subscribeToProfile,
    readProfile,
    () => undefined,
  );
  const liveUser: LiveUser | null =
    snapshot.status === 'authenticated'
      ? {
          id: snapshot.actor.id,
          role: snapshot.actor.role,
          name: profile?.fullName ?? fallbackUser?.name ?? '',
          email: profile?.email ?? fallbackUser?.email ?? '',
        }
      : null;

  return {
    snapshot,
    liveUser,
    sessionGeneration: snapshot.revision,
    applyLiveSession,
    clearSession,
    coordinator,
    cookieOperations,
    completeOAuthSession,
    isRestoringSession: snapshot.status === 'booting',
    restoreLiveSession,
  };
}
