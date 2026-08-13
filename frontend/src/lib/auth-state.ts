/**
 * Location: src/lib/auth-state.ts
 * Purpose: Define the presentation-only public user fallback.
 * Why: Unauthenticated consumers need a safe non-authoritative display value.
 */

import type { LiveUser } from './auth-types';

export const PUBLIC_USER: LiveUser = {
  id: '',
  name: 'Guest',
  email: '',
  role: 'public',
};
