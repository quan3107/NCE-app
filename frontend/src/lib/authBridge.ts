/**
 * Location: src/lib/authBridge.ts
 * Purpose: Share auth session helpers between React context and apiClient without creating circular imports.
 * Why: Allows fetch utilities to retrieve/refresh tokens while the provider controls session state.
 */

import type { RefreshAccessTokenResult } from './auth-types';

type AccessTokenGetter = () => string | null;
type RefreshInvoker = () => Promise<RefreshAccessTokenResult>;
type SessionClearer = () => void;
type SessionVersion = {
  generation: number;
  sessionEpoch: number;
  userId: string | null;
};
type SessionVersionGetter = () => SessionVersion;

const defaultHandlers = {
  getAccessToken: (): string | null => null,
  refreshAccessToken: async (): Promise<RefreshAccessTokenResult> => ({
    status: 'failed',
  }),
  clearSession: (): void => {},
  getSessionVersion: (): SessionVersion => ({
    generation: 0,
    sessionEpoch: 0,
    userId: null,
  }),
};

let handlers: {
  getAccessToken: AccessTokenGetter;
  refreshAccessToken: RefreshInvoker;
  clearSession: SessionClearer;
  getSessionVersion: SessionVersionGetter;
} = { ...defaultHandlers };

export const authBridge = {
  getAccessToken(): string | null {
    return handlers.getAccessToken();
  },
  async refreshAccessToken(): Promise<RefreshAccessTokenResult> {
    return handlers.refreshAccessToken();
  },
  clearSession(): void {
    handlers.clearSession();
  },
  getSessionVersion(): SessionVersion {
    return handlers.getSessionVersion();
  },
  configure(next: {
    getAccessToken?: AccessTokenGetter;
    refreshAccessToken?: RefreshInvoker;
    clearSession?: SessionClearer;
    getSessionVersion?: SessionVersionGetter;
  }): void {
    handlers = {
      getAccessToken: next.getAccessToken ?? handlers.getAccessToken,
      refreshAccessToken:
        next.refreshAccessToken ?? handlers.refreshAccessToken,
      clearSession: next.clearSession ?? handlers.clearSession,
      getSessionVersion:
        next.getSessionVersion ?? handlers.getSessionVersion,
    };
  },
  reset(): void {
    handlers = { ...defaultHandlers };
  },
};
