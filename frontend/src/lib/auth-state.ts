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

export const loadInitialState = (): InitialAuthSnapshot =>
  loadSharedAuthSnapshot();
