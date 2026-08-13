/**
 * Location: src/lib/auth-coordinator.ts
 * Purpose: Coordinate in-memory auth authority, readiness, cancellation, and refresh.
 * Why: Requests need one owner for admission and logical-session race protection.
 */

import {
  becomeAnonymous,
  becomeAuthenticated,
  initialAuthState,
  rotateAccessToken,
  type AuthMachineState,
  type SecurityActor,
} from './auth-machine';
import type { RefreshAccessTokenResult } from './auth-types';
import {
  loadAuthInvalidation,
  type AuthInvalidation,
} from './shared-auth-session';

export type AuthMode = 'none' | 'optional' | 'required';

export type AuthAdmission = {
  accessToken: string | null;
  actorId: string | null;
  revision: number;
  signal: AbortSignal;
  provenance?: symbol;
};

type RefreshHandler = () => Promise<RefreshAccessTokenResult>;
type Listener = (state: AuthMachineState) => void;
const MAX_ACKNOWLEDGED_INVALIDATIONS = 100;

function admissionError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class AuthCoordinator {
  private readonly provenance = Symbol('auth-coordinator');
  private state = initialAuthState();
  private requestController = new AbortController();
  private listeners = new Set<Listener>();
  private refreshHandler: RefreshHandler = async () => ({ status: 'failed' });
  private refreshSlot: {
    revision: number;
    promise: Promise<RefreshAccessTokenResult>;
  } | null = null;
  private resolveReadiness!: () => void;
  private acknowledgedInvalidationEpoch = 0;
  private acknowledgedInvalidationNonces = new Set<string>();
  private disposed = false;
  private readiness = new Promise<void>((resolve) => {
    this.resolveReadiness = resolve;
  });

  constructor() {
    const initialInvalidation = loadAuthInvalidation();
    if (initialInvalidation) {
      this.acknowledgeAuthInvalidation(initialInvalidation);
    }
  }

  getSnapshot(): AuthMachineState {
    return this.state;
  }

  waitUntilReady(): Promise<void> {
    return this.readiness;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  acknowledgeAuthInvalidation(invalidation: AuthInvalidation): void {
    if (invalidation.epoch < this.acknowledgedInvalidationEpoch) return;
    if (invalidation.epoch > this.acknowledgedInvalidationEpoch) {
      this.acknowledgedInvalidationEpoch = invalidation.epoch;
      this.acknowledgedInvalidationNonces.clear();
    }
    this.acknowledgedInvalidationNonces.add(invalidation.nonce);
    if (
      this.acknowledgedInvalidationNonces.size > MAX_ACKNOWLEDGED_INVALIDATIONS
    ) {
      const oldest = this.acknowledgedInvalidationNonces.values().next().value;
      if (oldest) this.acknowledgedInvalidationNonces.delete(oldest);
    }
  }

  hasAcknowledgedAuthInvalidation(invalidation: AuthInvalidation): boolean {
    if (invalidation.epoch < this.acknowledgedInvalidationEpoch) return true;
    if (invalidation.epoch > this.acknowledgedInvalidationEpoch) return false;
    return this.acknowledgedInvalidationNonces.has(invalidation.nonce);
  }

  finishBootstrap(): void {
    if (this.disposed) return;
    if (this.state.status !== 'booting') return;
    this.transition(becomeAnonymous(this.state));
    this.resolveReadiness();
  }

  authenticate(accessToken: string, actor: SecurityActor): void {
    if (this.disposed) return;
    this.abortAuthenticatedRequests();
    this.transition(becomeAuthenticated(this.state, accessToken, actor));
    if (this.state.revision === 1) this.resolveReadiness();
  }

  replaceToken(
    expectedRevision: number,
    expectedActorId: string,
    accessToken: string,
  ): boolean {
    if (this.disposed) return false;
    const next = rotateAccessToken(
      this.state,
      expectedRevision,
      expectedActorId,
      accessToken,
    );
    if (!next) return false;
    this.transition(next);
    return true;
  }

  clear(): void {
    if (this.disposed) return;
    this.abortAuthenticatedRequests();
    this.transition(becomeAnonymous(this.state));
    this.resolveReadiness();
  }

  admit(mode: Exclude<AuthMode, 'none'>): AuthAdmission {
    if (this.disposed) {
      throw admissionError('Authentication provider was retired.', 0);
    }
    if (this.hasUnacknowledgedSharedInvalidation()) {
      this.abortAuthenticatedRequests();
      throw admissionError('Authentication session changed in another tab.', 0);
    }
    if (this.state.status === 'booting') {
      throw admissionError('Authentication bootstrap is incomplete.', 0);
    }
    if (this.state.status === 'anonymous') {
      if (mode === 'required') {
        throw admissionError('Authentication is required.', 401);
      }
      return {
        accessToken: null,
        actorId: null,
        revision: this.state.revision,
        signal: this.requestController.signal,
        provenance: this.provenance,
      };
    }
    return {
      accessToken: this.state.accessToken,
      actorId: this.state.actor.id,
      revision: this.state.revision,
      signal: this.requestController.signal,
      provenance: this.provenance,
    };
  }

  isCurrent(admission: AuthAdmission): boolean {
    if (this.disposed || admission.provenance !== this.provenance) return false;
    if (this.hasUnacknowledgedSharedInvalidation()) {
      this.abortAuthenticatedRequests();
      return false;
    }
    const actorId =
      this.state.status === 'authenticated' ? this.state.actor.id : null;
    return (
      admission.revision === this.state.revision &&
      admission.actorId === actorId &&
      !admission.signal.aborted
    );
  }

  setRefreshHandler(handler: RefreshHandler): void {
    this.refreshHandler = handler;
  }

  refresh(): Promise<RefreshAccessTokenResult> {
    if (this.disposed) return Promise.resolve({ status: 'stale' });
    const revision = this.state.revision;
    if (this.refreshSlot?.revision === revision)
      return this.refreshSlot.promise;
    const promise = this.refreshHandler().finally(() => {
      if (this.refreshSlot?.promise === promise) this.refreshSlot = null;
    });
    this.refreshSlot = { revision, promise };
    return promise;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestController.abort();
    this.listeners.clear();
    this.resolveReadiness();
  }

  private transition(next: AuthMachineState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  private abortAuthenticatedRequests(): void {
    this.requestController.abort();
    this.requestController = new AbortController();
  }

  private hasUnacknowledgedSharedInvalidation(): boolean {
    const shared = loadAuthInvalidation();
    if (!shared || shared.epoch < this.acknowledgedInvalidationEpoch) {
      return false;
    }
    return (
      shared.epoch > this.acknowledgedInvalidationEpoch ||
      !this.acknowledgedInvalidationNonces.has(shared.nonce)
    );
  }
}
