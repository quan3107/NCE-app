/**
 * Location: src/lib/auth-state.ts
 * Purpose: Map backend users and load persisted auth snapshots.
 * Why: Separates storage compatibility logic from the React auth provider.
 */

import type { LiveUser, BackendAuthUser, InitialSnapshot, StoredAuthPayload } from './auth-types';
import { STORAGE_KEYS } from './constants';

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

export const loadInitialState = (): InitialSnapshot => {
  const defaultSnapshot: InitialSnapshot = {
    token: null,
    liveUser: null,
  };

  if (typeof window === 'undefined') {
    return defaultSnapshot;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!stored) {
      return defaultSnapshot;
    }

    const parsed = JSON.parse(stored) as StoredAuthPayload;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid stored auth payload');
    }

    let parsedToken: string | null = null;
    if ('token' in parsed && typeof parsed.token === 'string' && parsed.token.length > 0) {
      parsedToken = parsed.token;
    }
    const liveUser = parsed.liveUser ?? null;

    return {
      token: liveUser ? parsedToken : null,
      liveUser,
    };
  } catch {
    return defaultSnapshot;
  }
};
