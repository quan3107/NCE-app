/**
 * Location: src/lib/auth-state.ts
 * Purpose: Map backend users and load persisted auth snapshots.
 * Why: Separates storage compatibility logic from the React auth provider.
 */

import type {
  LiveUser,
  BackendAuthUser,
  InitialAuthSnapshot,
} from './auth-types';
import { loadSharedAuthSnapshot } from './shared-auth-session';

export const PUBLIC_USER: LiveUser = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'public',
};

export const mapBackendUser = (user: BackendAuthUser): LiveUser => ({
  id: user.id,
  email: user.email,
  name: user.fullName,
  role: user.role,
});

const isRestorableLiveUser = (value: LiveUser | null): value is LiveUser =>
  Boolean(
    value &&
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      typeof value.name === 'string' &&
      typeof value.email === 'string' &&
      (value.role === 'student' ||
        value.role === 'teacher' ||
        value.role === 'admin'),
  );

export const loadInitialState = (): InitialAuthSnapshot => {
  const snapshot = loadSharedAuthSnapshot();
  if (isRestorableLiveUser(snapshot.liveUser)) return snapshot;
  return { ...snapshot, token: null, liveUser: null };
};
