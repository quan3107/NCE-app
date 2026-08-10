/**
 * Location: src/lib/shared-auth-session.ts
 * Purpose: Share non-sensitive auth invalidations between browser tabs.
 * Why: Cross-tab transport may request server revalidation but never grant authority.
 */

import {
  localStorageOrNull,
  sessionStorageOrNull,
  storageGet,
  storageRemove,
  storageSet,
} from './browser-storage';
import { STORAGE_KEYS } from './constants';

export type AuthInvalidationReason =
  | 'account-change'
  | 'role-change'
  | 'logout'
  | 'server-revalidate'
  | 'legacy-message';

export type AuthInvalidation = {
  schemaVersion: 1;
  epoch: number;
  reason: AuthInvalidationReason;
  nonce: string;
};

const CHANNEL_NAME = 'nce-auth-session';
let channel: BroadcastChannel | null | undefined;
let nonceSequence = 0;

function nextNonce(): string {
  nonceSequence += 1;
  return `${Date.now().toString(36)}:${nonceSequence.toString(36)}`;
}

function normalize(value: unknown): AuthInvalidation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AuthInvalidation>;
  if (
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.epoch) ||
    Number(candidate.epoch) < 0 ||
    typeof candidate.nonce !== 'string'
  ) {
    return null;
  }
  const reasons: AuthInvalidationReason[] = [
    'account-change',
    'role-change',
    'logout',
    'server-revalidate',
    'legacy-message',
  ];
  if (!reasons.includes(candidate.reason as AuthInvalidationReason)) return null;
  return candidate as AuthInvalidation;
}

function parse(raw: string | null): AuthInvalidation | null {
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

function sharedChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

export function loadAuthInvalidation(): AuthInvalidation | null {
  const shared = localStorageOrNull();
  const fallback = sessionStorageOrNull();
  const local = parse(
    shared ? storageGet(shared, STORAGE_KEYS.authInvalidation) : null,
  );
  const session = parse(
    fallback ? storageGet(fallback, STORAGE_KEYS.authInvalidation) : null,
  );
  if (session && (!local || session.epoch > local.epoch)) return session;
  return local;
}

export function removeLegacyAuthSnapshot(): void {
  const shared = localStorageOrNull();
  const fallback = sessionStorageOrNull();
  if (shared) storageRemove(shared, STORAGE_KEYS.currentUser);
  if (fallback) storageRemove(fallback, STORAGE_KEYS.currentUser);
}

export function publishAuthInvalidation(
  reason: AuthInvalidationReason,
): AuthInvalidation {
  const previousEpoch = loadAuthInvalidation()?.epoch ?? 0;
  const invalidation: AuthInvalidation = {
    schemaVersion: 1,
    epoch: Math.max(previousEpoch, Date.now()) + 1,
    reason,
    nonce: nextNonce(),
  };
  const serialized = JSON.stringify(invalidation);
  const shared = localStorageOrNull();
  const fallback = sessionStorageOrNull();
  const committed = Boolean(
    shared && storageSet(shared, STORAGE_KEYS.authInvalidation, serialized),
  );
  if (!committed && fallback) {
    storageSet(fallback, STORAGE_KEYS.authInvalidation, serialized);
  }
  try {
    sharedChannel()?.postMessage(invalidation);
  } catch {
    channel = null;
  }
  return invalidation;
}

export function subscribeToAuthInvalidation(
  listener: (invalidation: AuthInvalidation) => void,
): () => void {
  let observedEpoch = 0;
  const accept = (candidate: AuthInvalidation | null) => {
    if (!candidate || candidate.epoch <= observedEpoch) return;
    observedEpoch = candidate.epoch;
    listener(candidate);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.authInvalidation) {
      accept(parse(event.newValue));
      return;
    }
    if (event.key === STORAGE_KEYS.currentUser) {
      listener({
        schemaVersion: 1,
        epoch: Date.now(),
        reason: 'legacy-message',
        nonce: nextNonce(),
      });
    }
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    const current = normalize(event.data);
    if (current) accept(current);
    else if (event.data && typeof event.data === 'object') {
      listener({
        schemaVersion: 1,
        epoch: Date.now(),
        reason: 'legacy-message',
        nonce: nextNonce(),
      });
    }
  };
  window.addEventListener('storage', onStorage);
  sharedChannel()?.addEventListener('message', onMessage);
  // Attach first, then catch up, closing the render/effect subscription gap.
  accept(loadAuthInvalidation());
  return () => {
    window.removeEventListener('storage', onStorage);
    sharedChannel()?.removeEventListener('message', onMessage);
  };
}
