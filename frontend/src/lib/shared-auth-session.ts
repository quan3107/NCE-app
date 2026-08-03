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
  profileRevision: number;
};

export type SharedAuthPersistResult =
  | { status: 'committed'; snapshot: SharedAuthSnapshot }
  | { status: 'fallback'; snapshot: SharedAuthSnapshot }
  | { status: 'volatile'; snapshot: SharedAuthSnapshot }
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
  if (!previous.liveUser) return false;
  if (previous.liveUser.id !== next.liveUser.id) return true;
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
  const profileRevision =
    typeof parsed.profileRevision === 'number' &&
    Number.isSafeInteger(parsed.profileRevision) &&
    parsed.profileRevision >= 0
      ? parsed.profileRevision
      : 0;
  const liveUser = parsed.liveUser ?? null;
  const token =
    liveUser && typeof parsed.token === 'string' && parsed.token.length > 0
      ? parsed.token
      : null;
  return {
    sessionEpoch,
    profileRevision,
    token,
    liveUser: liveUser as LiveUser | null,
  };
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

function publishSharedSnapshot(snapshot: SharedAuthSnapshot): void {
  const activeChannel = sharedChannel();
  if (!activeChannel) return;
  try {
    activeChannel.postMessage(snapshot);
  } catch {
    try {
      activeChannel.close();
    } catch {
      // The failed optional transport may already be closed.
    }
    channel = null;
  }
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
  if (
    fallback &&
    (!shared ||
      fallback.sessionEpoch > shared.sessionEpoch ||
      (fallback.sessionEpoch === shared.sessionEpoch &&
        fallback.profileRevision >= shared.profileRevision))
  ) {
    return fallback;
  }
  return shared ?? {
    sessionEpoch: 0,
    profileRevision: 0,
    token: null,
    liveUser: null,
  };
}

export function persistSharedAuthSnapshot(
  snapshot: PersistSnapshot,
  currentEpoch: number,
  advanceEpoch: boolean,
  previousSnapshot?: PersistSnapshot,
  currentProfileRevision = 0,
  advanceProfileRevision = false,
): SharedAuthPersistResult {
  const sharedStorage = localStorageOrNull();
  const fallbackStorage = sessionStorageOrNull();
  const storedSnapshot = loadSharedAuthSnapshot();
  const storedEpoch = storedSnapshot?.sessionEpoch ?? 0;
  const sessionEpoch = advanceEpoch
    ? Math.max(currentEpoch, storedEpoch, Date.now()) + 1
    : currentEpoch;
  if (
    !advanceEpoch &&
    (storedEpoch > currentEpoch ||
      (!advanceProfileRevision &&
        storedEpoch === currentEpoch &&
        storedSnapshot.profileRevision > currentProfileRevision))
  ) {
    // A late same-session refresh must not overwrite a newer tab transition.
    return { status: 'stale', snapshot: storedSnapshot };
  }
  const profileRevision = advanceEpoch
    ? 0
    : advanceProfileRevision
      ? Math.max(currentProfileRevision, storedSnapshot.profileRevision) + 1
      : currentProfileRevision;
  const shared = {
    ...snapshot,
    sessionEpoch,
    profileRevision,
  } satisfies SharedAuthSnapshot;
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
  const authorityReduced =
    advanceEpoch &&
    reducesAuthority(previousSnapshot ?? storedSnapshot, shared);
  let durableAuthorityRetired = false;
  if (unavailable && authorityReduced) {
    // Never leave a durable higher-authority bearer behind a volatile downgrade.
    const sharedRetired = Boolean(
      sharedStorage && storageRemove(sharedStorage, STORAGE_KEYS.currentUser),
    );
    const fallbackRetired = Boolean(
      fallbackStorage && storageRemove(fallbackStorage, STORAGE_KEYS.currentUser),
    );
    durableAuthorityRetired = sharedRetired && fallbackRetired;
  }
  if (
    (advanceEpoch && (!unavailable || authorityReduced)) ||
    advanceProfileRevision
  ) {
    if (advanceEpoch) abortAuthenticatedRequests();
    publishSharedSnapshot(shared);
  }
  if (unavailable) {
    return {
      status:
        authorityReduced && durableAuthorityRetired
          ? 'volatile'
          : 'unavailable',
      snapshot: shared,
    };
  }
  return {
    status: committed ? 'committed' : 'fallback',
    snapshot: shared,
  };
}

export function subscribeToSharedAuth(
  initialEpoch: number,
  consume: (snapshot: SharedAuthSnapshot, sessionChanged: boolean) => void,
  initialProfileRevision = 0,
): () => void {
  let observedEpoch = initialEpoch;
  let observedProfileRevision = initialProfileRevision;
  const accept = (candidate: SharedAuthSnapshot | null) => {
    if (
      !candidate ||
      candidate.sessionEpoch < observedEpoch ||
      (candidate.sessionEpoch === observedEpoch &&
        candidate.profileRevision <= observedProfileRevision)
    ) {
      return;
    }
    const sessionChanged = candidate.sessionEpoch > observedEpoch;
    observedEpoch = candidate.sessionEpoch;
    observedProfileRevision = candidate.profileRevision;
    if (sessionChanged) abortAuthenticatedRequests();
    consume(candidate, sessionChanged);
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
