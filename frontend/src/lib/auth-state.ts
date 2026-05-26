/**
 * Location: src/lib/auth-state.ts
 * Purpose: Map backend users and load persisted auth snapshots.
 * Why: Separates storage compatibility logic from the React auth provider.
 */

import type { LiveUser, BackendAuthUser, InitialSnapshot, StoredAuthPayload } from './auth-types';
import { ENABLE_DEV_AUTH_FALLBACK, STORAGE_KEYS } from './constants';
import {
  DEFAULT_PERSONA,
  PERSONA_USERS,
  PersonaKey,
  isPersonaKey,
} from './devPersonas';

export const DEFAULT_TOKEN = 'dev-admin-token';
export const DEMO_PASSWORD = 'Passw0rd!';

export const PUBLIC_USER: LiveUser = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'public',
};

export const PERSONA_BY_EMAIL = Object.values(PERSONA_USERS).reduce<Record<string, PersonaKey>>(
  (accumulator, personaUser) => {
    accumulator[personaUser.email.toLowerCase()] = personaUser.persona;
    return accumulator;
  },
  {},
);

export const mapBackendUser = (user: BackendAuthUser): LiveUser => ({
  id: user.id,
  email: user.email,
  name: user.fullName,
  role: user.role,
});

export const loadInitialState = (): InitialSnapshot => {
  const defaultSnapshot: InitialSnapshot = ENABLE_DEV_AUTH_FALLBACK
    ? {
        mode: 'persona',
        token: DEFAULT_TOKEN,
        persona: { basePersona: DEFAULT_PERSONA, actingPersona: null },
        liveUser: null,
      }
    : {
        mode: 'live',
        token: null,
        persona: { basePersona: DEFAULT_PERSONA, actingPersona: null },
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

    const storedMode = parsed.mode === 'live' ? 'live' : 'persona';
    const mode = ENABLE_DEV_AUTH_FALLBACK ? storedMode : 'live';
    const persona =
      parsed.persona ??
      {
        basePersona: isPersonaKey(parsed.basePersona) ? parsed.basePersona : DEFAULT_PERSONA,
        actingPersona: isPersonaKey(parsed.actingPersona) ? parsed.actingPersona : null,
      };

    const parsedToken =
      'token' in parsed
        ? typeof parsed.token === 'string' && parsed.token.length > 0
          ? parsed.token
          : null
        : null;
    const token =
      mode === 'live'
        ? parsedToken
        : ENABLE_DEV_AUTH_FALLBACK
          ? parsedToken ?? DEFAULT_TOKEN
          : null;

    const liveUser = mode === 'live' && parsed.liveUser ? parsed.liveUser : null;

    return {
      mode,
      token,
      persona,
      liveUser,
    };
  } catch {
    return defaultSnapshot;
  }
};
