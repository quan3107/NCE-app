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

export type AuthMode = 'none' | 'optional' | 'required';

export type AuthAdmission = {
  accessToken: string | null;
  actorId: string | null;
  revision: number;
  signal: AbortSignal;
};

type RefreshHandler = () => Promise<RefreshAccessTokenResult>;
type Listener = (state: AuthMachineState) => void;

function admissionError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class AuthCoordinator {
  private state = initialAuthState();
  private requestController = new AbortController();
  private listeners = new Set<Listener>();
  private refreshHandler: RefreshHandler = async () => ({ status: 'failed' });
  private refreshSlot: {
    revision: number;
    promise: Promise<RefreshAccessTokenResult>;
  } | null = null;
  private resolveReadiness!: () => void;
  private readiness = new Promise<void>((resolve) => {
    this.resolveReadiness = resolve;
  });

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

  finishBootstrap(): void {
    if (this.state.status !== 'booting') return;
    this.transition(becomeAnonymous(this.state));
    this.resolveReadiness();
  }

  authenticate(accessToken: string, actor: SecurityActor): void {
    this.abortAuthenticatedRequests();
    this.transition(becomeAuthenticated(this.state, accessToken, actor));
    if (this.state.revision === 1) this.resolveReadiness();
  }

  replaceToken(
    expectedRevision: number,
    expectedActorId: string,
    accessToken: string,
  ): boolean {
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
    this.abortAuthenticatedRequests();
    this.transition(becomeAnonymous(this.state));
    this.resolveReadiness();
  }

  admit(mode: Exclude<AuthMode, 'none'>): AuthAdmission {
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
      };
    }
    return {
      accessToken: this.state.accessToken,
      actorId: this.state.actor.id,
      revision: this.state.revision,
      signal: this.requestController.signal,
    };
  }

  isCurrent(admission: AuthAdmission): boolean {
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
    const revision = this.state.revision;
    if (this.refreshSlot?.revision === revision) return this.refreshSlot.promise;
    const promise = this.refreshHandler().finally(() => {
      if (this.refreshSlot?.promise === promise) this.refreshSlot = null;
    });
    this.refreshSlot = { revision, promise };
    return promise;
  }

  private transition(next: AuthMachineState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  private abortAuthenticatedRequests(): void {
    this.requestController.abort();
    this.requestController = new AbortController();
  }
}
