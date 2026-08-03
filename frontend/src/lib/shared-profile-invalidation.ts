/**
 * Location: src/lib/shared-profile-invalidation.ts
 * Purpose: Notify peer tabs that the active profile must be refetched.
 * Why: Broadcasting API responses can reorder concurrent database writes.
 */

const CHANNEL_NAME = 'nce-auth-profile-invalidation';

export type ProfileInvalidation = {
  type: 'profile-invalidated';
  userId: string;
  sessionEpoch: number;
};

let channel: BroadcastChannel | null | undefined;

function sharedChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  return channel;
}

function isProfileInvalidation(value: unknown): value is ProfileInvalidation {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ProfileInvalidation>;
  return (
    message.type === 'profile-invalidated' &&
    typeof message.userId === 'string' &&
    Number.isSafeInteger(message.sessionEpoch) &&
    Number(message.sessionEpoch) >= 0
  );
}

export function publishProfileInvalidation(
  invalidation: Omit<ProfileInvalidation, 'type'>,
): void {
  sharedChannel()?.postMessage({
    type: 'profile-invalidated',
    ...invalidation,
  } satisfies ProfileInvalidation);
}

export function subscribeToProfileInvalidation(
  listener: (invalidation: ProfileInvalidation) => void,
): () => void {
  const activeChannel = sharedChannel();
  if (!activeChannel) return () => undefined;
  const onMessage = (event: MessageEvent<unknown>) => {
    if (isProfileInvalidation(event.data)) listener(event.data);
  };
  activeChannel.addEventListener('message', onMessage);
  return () => activeChannel.removeEventListener('message', onMessage);
}
