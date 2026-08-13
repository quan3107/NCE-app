/**
 * Location: src/lib/use-auth-runtime.ts
 * Purpose: Bind the auth coordinator to cookie operations, React, and tab invalidations.
 * Why: One runtime must own bootstrap, refresh single-flight, transitions, and cancellation.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { apiClient } from './apiClient';
import { AuthCoordinator } from './auth-coordinator';
import type { AuthMachineState } from './auth-machine';
import { authBridge } from './authBridge';
import {
  createAuthCookieOperations,
  type AuthCookieOperations,
  type CookieCompensate,
} from './auth-cookie-operations';
import { backendUserToLiveUser, enterActorScope, profileFromCache } from './auth-session';
import type {
  AuthSuccessResponse,
  LiveUser,
  RefreshAccessTokenResult,
} from './auth-types';
import { useActiveProfileRuntime } from './use-active-profile-runtime';
import { queryClient } from './queryClient';
import {
  publishAuthInvalidation,
  removeLegacyAuthSnapshot,
  subscribeToAuthInvalidation,
  type AuthInvalidation,
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
  const oauthRevalidationRevision = useRef(0);
  const activeUserId = snapshot.status === 'authenticated' ? snapshot.actor.id : '';
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
      setFallbackUser(user);
      if (announce) {
        const previousRole =
          current.status === 'authenticated' ? current.actor.role : null;
        const invalidation = publishAuthInvalidation(
          previousRole && previousRole !== user.role ? 'role-change' : 'account-change',
        );
        coordinator.acknowledgeAuthInvalidation(invalidation);
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
      if (reason) {
        const invalidation = publishAuthInvalidation(reason);
        coordinator.acknowledgeAuthInvalidation(invalidation);
      }
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
        return await runner(async (signal, compensate, isSuperseded) => {
          const admitted = coordinator.getSnapshot();
          if (
            signal.aborted ||
            isSuperseded() ||
            admitted.revision !== expected.revision ||
            actorId(admitted) !== actorId(expected)
          ) {
            return { status: 'stale' };
          }
          const payload = await apiClient<AuthSuccessResponse>('/auth/refresh', {
            auth: 'none',
            method: 'POST',
            credentials: 'include',
            signal,
          });
          if (isSuperseded()) {
            await revokeRotatedCookie(compensate);
            return { status: 'stale' };
          }
          if (signal.aborted || !applyLiveSession(payload, expected, true, announce)) {
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

  const completeOAuthSession = useCallback(async () => {
    // Child callback effects run before this provider's bootstrap effect. Wait
    // until bootstrap owns the transition before capturing refresh authority.
    await coordinator.waitUntilReady();
    // Catch-up invalidations observed before this point are incorporated by the
    // lease owner. Later invalidations must drain only after it releases the lease.
    const incorporatedRevalidation = oauthRevalidationRevision.current;
    const result = await refreshWith(cookieOperations.runOAuthCompletion, true);
    if (oauthRevalidationRevision.current === incorporatedRevalidation) {
      return result;
    }
    return coordinator.refresh();
  }, [cookieOperations, coordinator, refreshWith]);

  const bridgeRegistration = useMemo(
    () =>
      authBridge.configure({
        refreshAccessToken: () => coordinator.refresh(),
        waitUntilReady: () => coordinator.waitUntilReady(),
        admit: (mode) => coordinator.admit(mode),
        isCurrent: (admission) => coordinator.isCurrent(admission),
        getSnapshot: () => coordinator.getSnapshot(),
      }),
    [coordinator],
  );

  useEffect(() => coordinator.subscribe(setSnapshot), [coordinator]);

  useActiveProfileRuntime(snapshot, cookieOperations, clearSession);

  useEffect(() => {
    let mounted = true;
    const revalidate = async (invalidation: AuthInvalidation) => {
      if (!mounted) return;
      if (coordinator.hasAcknowledgedAuthInvalidation(invalidation)) return;
      coordinator.acknowledgeAuthInvalidation(invalidation);
      cookieOperations.cancelRefreshes();
      clearSession();
      if (invalidation.reason === 'logout') return;
      if (
        window.location.pathname === '/auth/oauth' &&
        cookieOperations.hasOwnedOAuthLease()
      ) {
        oauthRevalidationRevision.current += 1;
        return;
      }
      await coordinator.refresh();
    };
    // Subscription performs its catch-up read before bootstrap starts.
    const unsubscribe = subscribeToAuthInvalidation(
      (invalidation) => void revalidate(invalidation),
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
      coordinator.dispose();
      authBridge.reset(bridgeRegistration);
    };
  }, [bridgeRegistration, clearSession, cookieOperations, coordinator]);

  const subscribeToProfile = useCallback(
    (listener: () => void) => queryClient.getQueryCache().subscribe(listener),
    [],
  );
  const readProfile = useCallback(
    () => (activeUserId ? profileFromCache(activeUserId) : undefined),
    [activeUserId],
  );
  const profile = useSyncExternalStore(subscribeToProfile, readProfile, () => undefined);
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
