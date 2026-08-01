/**
 * Location: src/lib/shared-auth-session.ts
 * Purpose: Publish and consume ordered browser-wide authentication transitions.
 * Why: Every tab must stop using bearer state as soon as identity or authority changes.
 */

import { localStorageOrNull, storageGet, storageSet } from './browser-storage';
import { STORAGE_KEYS } from './constants';
import type { LiveUser, PersistSnapshot } from './auth-types';

export type SharedAuthSnapshot = PersistSnapshot & {
  sessionEpoch: number;
};

export type SharedAuthPersistResult =
  | { status: 'committed'; snapshot: SharedAuthSnapshot }
  | { status: 'stale'; snapshot: SharedAuthSnapshot };

const CHANNEL_NAME = 'nce-auth-session';
let requestController = new AbortController();
let channel: BroadcastChannel | null | undefined;

function normalizeSnapshot(value: unknown): SharedAuthSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const parsed = value as Partial<SharedAuthSnapshot>;
  const sessionEpoch =
    typeof parsed.sessionEpoch === 'number' &&
    Number.isSafeInteger(parsed.sessionEpoch) &&
    parsed.sessionEpoch >= 0
      ? parsed.sessionEpoch
      : 0;
  const liveUser = parsed.liveUser ?? null;
  const token =
    liveUser && typeof parsed.token === 'string' && parsed.token.length > 0
      ? parsed.token
      : null;
  return { sessionEpoch, token, liveUser: liveUser as LiveUser | null };
}

function parseSnapshot(raw: string | null): SharedAuthSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

function sharedChannel(): BroadcastChannel | null {
  if (channel !== undefined) {
    return channel;
  }
  channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function abortAuthenticatedRequests(): void {
  requestController.abort();
  requestController = new AbortController();
}

export function loadSharedAuthSnapshot(): SharedAuthSnapshot {
  const storage = localStorageOrNull();
  return (
    parseSnapshot(
      storage ? storageGet(storage, STORAGE_KEYS.currentUser) : null,
    ) ?? { sessionEpoch: 0, token: null, liveUser: null }
  );
}

export function persistSharedAuthSnapshot(
  snapshot: PersistSnapshot,
  currentEpoch: number,
  advanceEpoch: boolean,
): SharedAuthPersistResult {
  const storage = localStorageOrNull();
  const storedSnapshot = storage
    ? parseSnapshot(storageGet(storage, STORAGE_KEYS.currentUser))
    : null;
  const storedEpoch = storedSnapshot?.sessionEpoch ?? 0;
  const sessionEpoch = advanceEpoch
    ? Math.max(currentEpoch, storedEpoch, Date.now()) + 1
    : currentEpoch;
  if (!advanceEpoch && storedSnapshot && storedEpoch > currentEpoch) {
    // A late same-session refresh must not overwrite a newer tab transition.
    return { status: 'stale', snapshot: storedSnapshot };
  }
  const shared = { ...snapshot, sessionEpoch } satisfies SharedAuthSnapshot;
  if (storage) {
    storageSet(storage, STORAGE_KEYS.currentUser, JSON.stringify(shared));
  }
  if (advanceEpoch) {
    abortAuthenticatedRequests();
    sharedChannel()?.postMessage(shared);
  }
  return { status: 'committed', snapshot: shared };
}

export function subscribeToSharedAuth(
  initialEpoch: number,
  consume: (snapshot: SharedAuthSnapshot) => void,
): () => void {
  let observedEpoch = initialEpoch;
  const accept = (candidate: SharedAuthSnapshot | null) => {
    if (!candidate || candidate.sessionEpoch <= observedEpoch) {
      return;
    }
    observedEpoch = candidate.sessionEpoch;
    abortAuthenticatedRequests();
    consume(candidate);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.currentUser) {
      accept(parseSnapshot(event.newValue));
    }
  };
  const onBroadcast = (event: MessageEvent<unknown>) => {
    accept(normalizeSnapshot(event.data));
  };
  window.addEventListener('storage', onStorage);
  sharedChannel()?.addEventListener('message', onBroadcast);
  return () => {
    window.removeEventListener('storage', onStorage);
    sharedChannel()?.removeEventListener('message', onBroadcast);
  };
}

export function authenticatedRequestSignal(
  callerSignal?: AbortSignal,
): AbortSignal {
  return callerSignal
    ? AbortSignal.any([callerSignal, requestController.signal])
    : requestController.signal;
}
