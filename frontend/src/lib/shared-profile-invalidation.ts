/**
 * Location: src/lib/shared-profile-invalidation.ts
 * Purpose: Notify peer tabs that the active profile must be refetched.
 * Why: Broadcasting API responses can reorder concurrent database writes.
 */

import { localStorageOrNull, storageSet } from './browser-storage';

const CHANNEL_NAME = 'nce-auth-profile-invalidation';
const STORAGE_KEY = 'nce:auth-profile-invalidation';
const MAX_OBSERVED_PUBLICATIONS = 100;

export type ProfileInvalidation = {
  type: 'profile-invalidated';
  userId: string;
  sessionEpoch: number;
  publicationId: string;
};

let channel: BroadcastChannel | null | undefined;
let publicationSequence = 0;

function nextPublicationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  publicationSequence += 1;
  return `${Date.now()}:${publicationSequence}`;
}

function sharedChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    channel = null;
    return channel;
  }
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

function isProfileInvalidation(value: unknown): value is ProfileInvalidation {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ProfileInvalidation>;
  return (
    message.type === 'profile-invalidated' &&
    typeof message.userId === 'string' &&
    Number.isSafeInteger(message.sessionEpoch) &&
    Number(message.sessionEpoch) >= 0 &&
    typeof message.publicationId === 'string'
  );
}

function parseInvalidation(raw: string | null): ProfileInvalidation | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProfileInvalidation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function publishProfileInvalidation(
  invalidation: Omit<ProfileInvalidation, 'type' | 'publicationId'>,
): void {
  const message = {
    type: 'profile-invalidated',
    ...invalidation,
    publicationId: nextPublicationId(),
  } satisfies ProfileInvalidation;
  try {
    const activeChannel = sharedChannel();
    if (activeChannel) {
      activeChannel.postMessage(message);
    }
  } catch {
    channel = null;
  }
  const storage = localStorageOrNull();
  if (storage) storageSet(storage, STORAGE_KEY, JSON.stringify(message));
}

export function subscribeToProfileInvalidation(
  listener: (invalidation: ProfileInvalidation) => void,
): () => void {
  const activeChannel = sharedChannel();
  const observedPublicationIds = new Set<string>();
  const accept = (candidate: ProfileInvalidation | null) => {
    if (!candidate || observedPublicationIds.has(candidate.publicationId)) {
      return;
    }
    observedPublicationIds.add(candidate.publicationId);
    if (observedPublicationIds.size > MAX_OBSERVED_PUBLICATIONS) {
      const oldest = observedPublicationIds.values().next().value;
      if (oldest) observedPublicationIds.delete(oldest);
    }
    listener(candidate);
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    accept(isProfileInvalidation(event.data) ? event.data : null);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) accept(parseInvalidation(event.newValue));
  };
  activeChannel?.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  return () => {
    activeChannel?.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
}
