/**
 * Location: src/lib/authBridge.ts
 * Purpose: Share auth session helpers between React context and apiClient without creating circular imports.
 * Why: Allows fetch utilities to retrieve/refresh tokens while the provider controls session state.
 */

type AccessTokenGetter = () => string | null;
type RefreshInvoker = () => Promise<string | null>;
type SessionClearer = () => void;

const defaultHandlers = {
  getAccessToken: (): string | null => null,
  refreshAccessToken: async (): Promise<string | null> => null,
  clearSession: (): void => {},
};

let handlers: {
  getAccessToken: AccessTokenGetter;
  refreshAccessToken: RefreshInvoker;
  clearSession: SessionClearer;
} = { ...defaultHandlers };

export const authBridge = {
  getAccessToken(): string | null {
    return handlers.getAccessToken();
  },
  async refreshAccessToken(): Promise<string | null> {
    return handlers.refreshAccessToken();
  },
  clearSession(): void {
    handlers.clearSession();
  },
  configure(next: {
    getAccessToken?: AccessTokenGetter;
    refreshAccessToken?: RefreshInvoker;
    clearSession?: SessionClearer;
  }): void {
    handlers = {
      getAccessToken: next.getAccessToken ?? handlers.getAccessToken,
      refreshAccessToken:
        next.refreshAccessToken ?? handlers.refreshAccessToken,
      clearSession: next.clearSession ?? handlers.clearSession,
    };
  },
  reset(): void {
    handlers = { ...defaultHandlers };
  },
};

