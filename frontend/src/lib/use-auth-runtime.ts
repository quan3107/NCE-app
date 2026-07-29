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

export function useAuthRuntime() {
  const session = useAuthSession();
  const {
    tokenRef,
    refreshPromiseRef,
    shouldRefreshOnMountRef,
    getSessionVersion,
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
          applyLiveSession(result, sessionVersionAtRefreshStart);
          return { status: 'refreshed', accessToken: result.accessToken };
        },
      )
        .catch((): RefreshAccessTokenResult => {
          const currentVersion = getSessionVersion();
          if (
            currentVersion.generation !== sessionVersionAtRefreshStart.generation ||
            currentVersion.userId !== sessionVersionAtRefreshStart.userId
          ) {
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
    [applyLiveSession, clearSession, getSessionVersion, refreshPromiseRef, tokenRef],
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
  }, [clearSession, getSessionVersion, refreshAccessToken]);

  useEffect(
    () => () => cookieOperations.cancelRefreshes(),
    [cookieOperations],
  );

  useEffect(() => {
    if (!shouldRefreshOnMountRef.current) {
      setIsRestoringSession(false);
      return;
    }
    shouldRefreshOnMountRef.current = false;
    if (cookieOperations.hasOwnedOAuthLease()) {
      setIsRestoringSession(false);
      return;
    }
    void restoreLiveSession();
  }, [cookieOperations, restoreLiveSession, shouldRefreshOnMountRef]);

  return {
    ...session,
    cookieOperations,
    completeOAuthSession,
    isRestoringSession,
    refreshAccessToken,
    restoreLiveSession,
  };
}
