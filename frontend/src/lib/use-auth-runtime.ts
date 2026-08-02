/**
 * Location: src/lib/use-auth-runtime.ts
 * Purpose: Coordinate auth refresh, restore, cancellation, and bridge lifecycle.
 * Why: Keeps refresh infrastructure separate from user-facing AuthProvider actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient } from './apiClient';
import { authBridge } from './authBridge';
import {
  createAuthCookieOperations,
  type AuthCookieOperations,
} from './auth-cookie-operations';
import { shouldClearSessionAfterRefreshFailure } from './auth-refresh';
import { useAuthSession } from './auth-session';
import type {
  AuthSuccessResponse,
  RefreshAccessTokenResult,
} from './auth-types';
import { subscribeToSharedAuth } from './shared-auth-session';

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

export function useAuthRuntime() {
  const session = useAuthSession();
  const {
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    getSessionVersion,
    getAdmissionSessionVersion,
    applyLiveSession,
    clearSession,
  } = session;
  const [isRestoringSession, setIsRestoringSession] = useState(
    shouldRefreshOnMountRef.current,
  );
  const cookieOperations = useMemo(createAuthCookieOperations, []);

  const refreshSessionWith = useCallback(
    async (
      runCookieOperation: AuthCookieOperations['runRefresh'],
    ): Promise<RefreshAccessTokenResult> => {
      const sessionVersionAtRefreshStart = getSessionVersion();
      if (
        refreshPromiseRef.current?.generation ===
        sessionVersionAtRefreshStart.generation
      ) {
        return refreshPromiseRef.current.promise;
      }

      const tokenAtRefreshStart = tokenRef.current;
      let refreshPromise!: Promise<RefreshAccessTokenResult>;
      refreshPromise = runCookieOperation(
        async (signal): Promise<RefreshAccessTokenResult> => {
          const versionBeforeRequest = getSessionVersion();
          if (
            versionBeforeRequest.generation !== sessionVersionAtRefreshStart.generation ||
            versionBeforeRequest.userId !== sessionVersionAtRefreshStart.userId
          ) {
            return { status: 'stale' };
          }
          const result = await apiClient<AuthSuccessResponse>('/auth/refresh', {
            method: 'POST',
            withAuth: false,
            credentials: 'include',
            signal,
          });
          const currentVersion = getSessionVersion();
          if (
            currentVersion.generation !== sessionVersionAtRefreshStart.generation ||
            currentVersion.userId !== sessionVersionAtRefreshStart.userId
          ) {
            return { status: 'stale' };
          }
          if (!applyLiveSession(result, sessionVersionAtRefreshStart)) {
            return { status: 'stale' };
          }
          return { status: 'refreshed', accessToken: result.accessToken };
        },
      )
        .catch((error): RefreshAccessTokenResult => {
          const currentVersion = getAdmissionSessionVersion();
          if (
            currentVersion.generation !== sessionVersionAtRefreshStart.generation ||
            currentVersion.sessionEpoch !== sessionVersionAtRefreshStart.sessionEpoch ||
            currentVersion.userRevision !== sessionVersionAtRefreshStart.userRevision ||
            currentVersion.userId !== sessionVersionAtRefreshStart.userId
          ) {
            return { status: 'stale' };
          }
          if (isAbortError(error)) {
            return { status: 'stale' };
          }
          if (
            shouldClearSessionAfterRefreshFailure(
              tokenAtRefreshStart,
              tokenRef.current,
            )
          ) {
            clearSession();
          }
          return { status: 'failed' };
        })
        .finally(() => {
          if (refreshPromiseRef.current?.promise === refreshPromise) {
            refreshPromiseRef.current = null;
          }
        });

      refreshPromiseRef.current = {
        generation: sessionVersionAtRefreshStart.generation,
        promise: refreshPromise,
      };
      return refreshPromise;
    },
    [
      applyLiveSession,
      clearSession,
      getAdmissionSessionVersion,
      getSessionVersion,
      refreshPromiseRef,
      tokenRef,
    ],
  );

  const refreshAccessToken = useCallback(
    (): Promise<RefreshAccessTokenResult> =>
      refreshSessionWith(cookieOperations.runRefresh),
    [cookieOperations, refreshSessionWith],
  );

  const completeOAuthSession = useCallback(
    (): Promise<RefreshAccessTokenResult> =>
      refreshSessionWith(cookieOperations.runOAuthCompletion),
    [cookieOperations, refreshSessionWith],
  );

  const restoreLiveSession = useCallback(async (): Promise<boolean> => {
    setIsRestoringSession(true);
    try {
      const result = await refreshAccessToken();
      return result.status === 'refreshed';
    } finally {
      setIsRestoringSession(false);
    }
  }, [refreshAccessToken]);

  authBridge.configure({
    getAccessToken: () => tokenRef.current,
    refreshAccessToken,
    clearSession,
    getSessionVersion,
  });
  useEffect(() => {
    authBridge.configure({
      getAccessToken: () => tokenRef.current,
      refreshAccessToken,
      clearSession,
      getSessionVersion,
    });
    return () => {
      authBridge.reset();
    };
  }, [clearSession, getSessionVersion, refreshAccessToken, tokenRef]);

  useEffect(() => () => {
    cookieOperations.cancelRefreshes();
    cookieOperations.cancelOAuthCompletions();
  }, [cookieOperations]);

  useEffect(() => {
    let cancelled = false;
    const releaseAbandonedOAuthLease = async () => {
      if (
        window.location.pathname !== '/auth/oauth' &&
        cookieOperations.hasOwnedOAuthLease()
      ) {
        await cookieOperations.releaseOAuthLease().catch(() => undefined);
      }
    };
    const initialize = async () => {
      await releaseAbandonedOAuthLease();
      if (cancelled) {
        return;
      }
      if (!shouldRefreshOnMountRef.current) {
        setIsRestoringSession(false);
        return;
      }
      if (cookieOperations.hasOwnedOAuthLease()) {
        setIsRestoringSession(false);
        return;
      }
      shouldRefreshOnMountRef.current = false;
      await restoreLiveSession();
    };
    const onPageShow = () => void initialize();
    void initialize();
    window.addEventListener('pageshow', onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [cookieOperations, restoreLiveSession, shouldRefreshOnMountRef]);

  useEffect(
    () =>
      subscribeToSharedAuth(getSessionVersion().sessionEpoch, (_snapshot, sessionChanged) => {
        if (sessionChanged) cookieOperations.cancelRefreshes();
      }),
    [cookieOperations, getSessionVersion],
  );

  return {
    ...session,
    cookieOperations,
    completeOAuthSession,
    isRestoringSession,
    refreshAccessToken,
    restoreLiveSession,
  };
}
