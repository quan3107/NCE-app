/**
 * Location: src/lib/auth-machine.ts
 * Purpose: Define pure authentication states and logical transitions.
 * Why: Authority should have one explicit, reviewable in-memory representation.
 */

import type { SupportedRole } from './auth-types';

export type SecurityActor = {
  id: string;
  role: SupportedRole;
};

export type AuthMachineState =
  | { status: 'booting'; revision: number }
  | { status: 'anonymous'; revision: number }
  | {
      status: 'authenticated';
      revision: number;
      accessToken: string;
      actor: SecurityActor;
    };

export const initialAuthState = (): AuthMachineState => ({
  status: 'booting',
  revision: 0,
});

export function becomeAnonymous(state: AuthMachineState): AuthMachineState {
  return { status: 'anonymous', revision: state.revision + 1 };
}

export function becomeAuthenticated(
  state: AuthMachineState,
  accessToken: string,
  actor: SecurityActor,
): AuthMachineState {
  return {
    status: 'authenticated',
    revision: state.revision + 1,
    accessToken,
    actor,
  };
}

export function rotateAccessToken(
  state: AuthMachineState,
  expectedRevision: number,
  expectedActorId: string,
  accessToken: string,
): AuthMachineState | null {
  if (
    state.status !== 'authenticated' ||
    state.revision !== expectedRevision ||
    state.actor.id !== expectedActorId
  ) {
    return null;
  }
  return { ...state, accessToken };
}
