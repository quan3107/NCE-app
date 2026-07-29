/**
 * Location: src/lib/auth-cookie-coordination.ts
 * Purpose: Coordinate refresh-cookie mutations across browser tabs and OAuth navigation.
 * Why: Every supported browser path needs one recoverable, cross-tab cookie-write boundary.
 */

const AUTH_COOKIE_LOCK_NAME = 'nce-auth-cookie-operations';
const AUTH_COOKIE_CHOOSING_PREFIX = 'nce:auth-cookie-choosing:';
const AUTH_COOKIE_TICKET_PREFIX = 'nce:auth-cookie-ticket:';
const OAUTH_LEASE_KEY = 'nce:auth-cookie-oauth-lease';
const OAUTH_LEASE_OWNER_KEY = 'nce:auth-cookie-oauth-owner';
const OAUTH_LEASE_MS = 5 * 60 * 1000;
const LEASE_POLL_MS = 25;
const RETRY_LOCK = Symbol('retry-auth-cookie-lock');

type StorageLease = {
  ownerId: string;
  expiresAt: number;
  ticket?: number;
};

function abortError(): Error {
  const error = new Error('Authentication cookie operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function readLease(key: string): StorageLease | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StorageLease>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      storage.removeItem(key);
      return null;
    }
    return parsed as StorageLease;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function ownedOAuthLeaseId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(OAUTH_LEASE_OWNER_KEY);
}

function isOAuthLeaseAvailable(allowOwnedLease: boolean): boolean {
  const lease = readLease(OAUTH_LEASE_KEY);
  return Boolean(
    !lease ||
      (allowOwnedLease && lease.ownerId === ownedOAuthLeaseId()),
  );
}

function delayForLease(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, LEASE_POLL_MS);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitForOAuthLease(
  signal: AbortSignal,
  allowOwnedLease: boolean,
): Promise<void> {
  while (!isOAuthLeaseAvailable(allowOwnedLease)) {
    await delayForLease(signal);
  }
}

async function acquireStorageLock(
  signal: AbortSignal,
  leaseMs: number,
): Promise<() => void> {
  const storage = browserStorage();
  if (!storage) {
    return () => undefined;
  }
  const ownerId = crypto.randomUUID();
  const choosingKey = `${AUTH_COOKIE_CHOOSING_PREFIX}${ownerId}`;
  const ticketKey = `${AUTH_COOKIE_TICKET_PREFIX}${ownerId}`;
  const expiresAt = Date.now() + Math.max(leaseMs, 60_000);
  storage.setItem(choosingKey, JSON.stringify({ ownerId, expiresAt }));
  let maxTicket = 0;
  for (const key of Object.keys(storage)) {
    if (!key?.startsWith(AUTH_COOKIE_TICKET_PREFIX)) {
      continue;
    }
    const ticket = readLease(key)?.ticket;
    if (typeof ticket === 'number' && ticket > maxTicket) {
      maxTicket = ticket;
    }
  }
  const ticket = maxTicket + 1;
  storage.setItem(ticketKey, JSON.stringify({ ownerId, expiresAt, ticket }));
  storage.removeItem(choosingKey);

  while (true) {
    if (signal.aborted) {
      storage.removeItem(choosingKey);
      storage.removeItem(ticketKey);
      throw abortError();
    }
    const participants = new Set<string>();
    for (const key of Object.keys(storage)) {
      if (key?.startsWith(AUTH_COOKIE_CHOOSING_PREFIX)) {
        participants.add(key.slice(AUTH_COOKIE_CHOOSING_PREFIX.length));
      }
      if (key?.startsWith(AUTH_COOKIE_TICKET_PREFIX)) {
        participants.add(key.slice(AUTH_COOKIE_TICKET_PREFIX.length));
      }
    }
    let hasPriorityContender = false;
    for (const participantId of participants) {
      if (participantId === ownerId) {
        continue;
      }
      if (readLease(`${AUTH_COOKIE_CHOOSING_PREFIX}${participantId}`)) {
        hasPriorityContender = true;
        break;
      }
      const contender = readLease(
        `${AUTH_COOKIE_TICKET_PREFIX}${participantId}`,
      );
      if (
        typeof contender?.ticket === 'number' &&
        (contender.ticket < ticket ||
          (contender.ticket === ticket && participantId < ownerId))
      ) {
        hasPriorityContender = true;
        break;
      }
    }
    if (!hasPriorityContender) {
      return () => {
        if (readLease(ticketKey)?.ownerId === ownerId) {
          storage.removeItem(ticketKey);
        }
      };
    }
    await delayForLease(signal);
  }
}

async function runWithStorageLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: () => Promise<T>,
): Promise<T | typeof RETRY_LOCK> {
  const release = await acquireStorageLock(signal, leaseMs);
  try {
    if (!isOAuthLeaseAvailable(allowOwnedLease)) {
      return RETRY_LOCK;
    }
    return await operation();
  } finally {
    release();
  }
}

export async function runWithCrossTabAuthLock<T>(
  signal: AbortSignal,
  allowOwnedLease: boolean,
  leaseMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof window === 'undefined') {
    return operation();
  }
  while (true) {
    await waitForOAuthLease(signal, allowOwnedLease);
    const result = navigator.locks
      ? await navigator.locks.request(
          AUTH_COOKIE_LOCK_NAME,
          { mode: 'exclusive', signal },
          () =>
            isOAuthLeaseAvailable(allowOwnedLease)
              ? operation()
              : RETRY_LOCK,
        )
      : await runWithStorageLock(
          signal,
          allowOwnedLease,
          leaseMs,
          operation,
        );
    if (result !== RETRY_LOCK) {
      return result;
    }
  }
}

export function createOAuthLease(): void {
  const storage = browserStorage();
  if (!storage || typeof window === 'undefined') {
    return;
  }
  const ownerId = crypto.randomUUID();
  window.sessionStorage.setItem(OAUTH_LEASE_OWNER_KEY, ownerId);
  storage.setItem(
    OAUTH_LEASE_KEY,
    JSON.stringify({ ownerId, expiresAt: Date.now() + OAUTH_LEASE_MS }),
  );
}

export function clearOwnedOAuthLease(): void {
  const storage = browserStorage();
  if (!storage || typeof window === 'undefined') {
    return;
  }
  const ownerId = ownedOAuthLeaseId();
  if (readLease(OAUTH_LEASE_KEY)?.ownerId === ownerId) {
    storage.removeItem(OAUTH_LEASE_KEY);
  }
  window.sessionStorage.removeItem(OAUTH_LEASE_OWNER_KEY);
}

export function hasOwnedOAuthLease(): boolean {
  const ownerId = ownedOAuthLeaseId();
  return Boolean(ownerId && readLease(OAUTH_LEASE_KEY)?.ownerId === ownerId);
}
