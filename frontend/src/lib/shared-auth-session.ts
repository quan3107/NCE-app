/**
 * Location: src/lib/shared-auth-session.ts
 * Purpose: Publish and consume ordered browser-wide authentication transitions.
 * Why: Every tab must stop using bearer state as soon as identity or authority changes.
 */

import {
  localStorageOrNull,
  sessionStorageOrNull,
  storageGet,
  storageRemove,
  storageSet,
} from './browser-storage';
import { STORAGE_KEYS } from './constants';
import type { LiveUser, PersistSnapshot } from './auth-types';

export type SharedAuthSnapshot = PersistSnapshot & {
  sessionEpoch: number;
};

export type SharedAuthPersistResult =
  | { status: 'committed'; snapshot: SharedAuthSnapshot }
  | { status: 'fallback'; snapshot: SharedAuthSnapshot }
  | { status: 'unavailable'; snapshot: SharedAuthSnapshot }
  | { status: 'stale'; snapshot: SharedAuthSnapshot };

const CHANNEL_NAME = 'nce-auth-session';
const ROLE_AUTHORITY: Record<LiveUser['role'], number> = {
  public: 0,
  student: 1,
  teacher: 2,
  admin: 3,
};
let requestController = new AbortController();
let channel: BroadcastChannel | null | undefined;

function reducesAuthority(
  previous: PersistSnapshot,
  next: PersistSnapshot,
): boolean {
  if (!next.token || !next.liveUser) return true;
  if (!previous.liveUser || previous.liveUser.id !== next.liveUser.id) {
    return false;
  }
  return (
    ROLE_AUTHORITY[next.liveUser.role] <
    ROLE_AUTHORITY[previous.liveUser.role]
  );
}

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
  const sharedStorage = localStorageOrNull();
  const fallbackStorage = sessionStorageOrNull();
  const shared = parseSnapshot(
    sharedStorage ? storageGet(sharedStorage, STORAGE_KEYS.currentUser) : null,
  );
  const fallback = parseSnapshot(
    fallbackStorage
      ? storageGet(fallbackStorage, STORAGE_KEYS.currentUser)
      : null,
  );
  if (fallback && (!shared || fallback.sessionEpoch >= shared.sessionEpoch)) {
    return fallback;
  }
  return shared ?? { sessionEpoch: 0, token: null, liveUser: null };
}

export function persistSharedAuthSnapshot(
  snapshot: PersistSnapshot,
  currentEpoch: number,
  advanceEpoch: boolean,
  previousSnapshot?: PersistSnapshot,
): SharedAuthPersistResult {
  const sharedStorage = localStorageOrNull();
  const fallbackStorage = sessionStorageOrNull();
  const storedSnapshot = loadSharedAuthSnapshot();
  const storedEpoch = storedSnapshot?.sessionEpoch ?? 0;
  const sessionEpoch = advanceEpoch
    ? Math.max(currentEpoch, storedEpoch, Date.now()) + 1
    : currentEpoch;
  if (!advanceEpoch && storedSnapshot && storedEpoch > currentEpoch) {
    // A late same-session refresh must not overwrite a newer tab transition.
    return { status: 'stale', snapshot: storedSnapshot };
  }
  const shared = { ...snapshot, sessionEpoch } satisfies SharedAuthSnapshot;
  const serialized = JSON.stringify(shared);
  const committed = sharedStorage
    ? storageSet(sharedStorage, STORAGE_KEYS.currentUser, serialized)
    : false;
  if (committed && fallbackStorage) {
    storageRemove(fallbackStorage, STORAGE_KEYS.currentUser);
  }
  const fallbackCommitted =
    !committed && fallbackStorage
      ? storageSet(fallbackStorage, STORAGE_KEYS.currentUser, serialized)
      : false;
  const unavailable = !committed && !fallbackCommitted;
  if (
    advanceEpoch &&
    (!unavailable || reducesAuthority(previousSnapshot ?? storedSnapshot, shared))
  ) {
    abortAuthenticatedRequests();
    sharedChannel()?.postMessage(shared);
  }
  if (unavailable) {
    return { status: 'unavailable', snapshot: shared };
  }
  return {
    status: committed ? 'committed' : 'fallback',
    snapshot: shared,
  };
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
