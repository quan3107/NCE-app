/**
 * Location: src/lib/authBridge.ts
 * Purpose: Share auth session helpers between React context and apiClient without creating circular imports.
 * Why: Allows fetch utilities to retrieve/refresh tokens while the provider controls session state.
 */

import type { AuthAdmission, AuthMode } from './auth-coordinator';
import type { AuthMachineState } from './auth-machine';
import type { RefreshAccessTokenResult } from './auth-types';

type RefreshInvoker = () => Promise<RefreshAccessTokenResult>;
type ReadinessWaiter = () => Promise<void>;
type AdmissionGetter = (mode: Exclude<AuthMode, 'none'>) => AuthAdmission;
type AdmissionChecker = (admission: AuthAdmission) => boolean;
type SnapshotGetter = () => AuthMachineState;

const defaultController = new AbortController();

const defaultHandlers = {
  refreshAccessToken: async (): Promise<RefreshAccessTokenResult> => ({
    status: 'failed',
  }),
  waitUntilReady: async (): Promise<void> => {},
  admit: (mode: Exclude<AuthMode, 'none'>): AuthAdmission => {
    if (mode === 'required') {
      throw Object.assign(new Error('Authentication is required.'), {
        status: 401,
      });
    }
    return {
      accessToken: null,
      actorId: null,
      revision: 0,
      signal: defaultController.signal,
    };
  },
  isCurrent: (): boolean => false,
  getSnapshot: (): AuthMachineState => ({ status: 'booting', revision: 0 }),
};

let handlers: {
  refreshAccessToken: RefreshInvoker;
  waitUntilReady: ReadinessWaiter;
  admit: AdmissionGetter;
  isCurrent: AdmissionChecker;
  getSnapshot: SnapshotGetter;
} = { ...defaultHandlers };
let registration = Symbol('unconfigured-auth-bridge');

export const authBridge = {
  async refreshAccessToken(): Promise<RefreshAccessTokenResult> {
    return handlers.refreshAccessToken();
  },
  waitUntilReady(): Promise<void> {
    return handlers.waitUntilReady();
  },
  admit(mode: Exclude<AuthMode, 'none'>): AuthAdmission {
    return handlers.admit(mode);
  },
  isCurrent(admission: AuthAdmission): boolean {
    return handlers.isCurrent(admission);
  },
  getSnapshot(): AuthMachineState {
    return handlers.getSnapshot();
  },
  configure(next: {
    refreshAccessToken?: RefreshInvoker;
    waitUntilReady?: ReadinessWaiter;
    admit?: AdmissionGetter;
    isCurrent?: AdmissionChecker;
    getSnapshot?: SnapshotGetter;
  }): symbol {
    registration = Symbol('configured-auth-bridge');
    handlers = {
      refreshAccessToken:
        next.refreshAccessToken ?? handlers.refreshAccessToken,
      waitUntilReady: next.waitUntilReady ?? handlers.waitUntilReady,
      admit: next.admit ?? handlers.admit,
      isCurrent: next.isCurrent ?? handlers.isCurrent,
      getSnapshot: next.getSnapshot ?? handlers.getSnapshot,
    };
    return registration;
  },
  reset(expectedRegistration?: symbol): void {
    if (expectedRegistration && expectedRegistration !== registration) return;
    registration = Symbol('unconfigured-auth-bridge');
    handlers = { ...defaultHandlers };
  },
};
