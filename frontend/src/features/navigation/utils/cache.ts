/**
 * Location: src/features/navigation/utils/cache.ts
 * Purpose: Manage localStorage cache for navigation payloads and badge counts.
 * Why: Supports fast startup and short offline resilience with safe parsing/expiry checks.
 */

import type { Role } from '@lib/mock-data';

import type {
  BadgeCacheRecord,
  BadgeCounts,
  NavigationCacheRecord,
  NavigationPayload,
} from '../types';
import { isBadgeCounts, isNavigationPayload } from '../types';

const NAVIGATION_CACHE_PREFIX = 'nce_navigation_cache';
const BADGE_CACHE_PREFIX = 'nce_navigation_badge_cache';

const NAVIGATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BADGE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheIdentity = {
  userId: string;
  role: Role;
};

const hasStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeRead = (key: string): string | null => {
  if (!hasStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string): void => {
  if (!hasStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep navigation functional even when storage is unavailable.
  }
};

const safeRemove = (key: string): void => {
  if (!hasStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Intentionally ignored.
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNavigationCacheRecord = (value: unknown): value is NavigationCacheRecord => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNavigationPayload(value.data) &&
    typeof value.role === 'string' &&
    typeof value.timestamp === 'number'
  );
};

const isBadgeCacheRecord = (value: unknown): value is BadgeCacheRecord => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBadgeCounts(value.data) &&
    typeof value.role === 'string' &&
    typeof value.timestamp === 'number'
  );
};

const isExpired = (timestamp: number, ttlMs: number): boolean => Date.now() - timestamp > ttlMs;

export const buildNavigationCacheKey = ({ userId, role }: CacheIdentity): string =>
  `${NAVIGATION_CACHE_PREFIX}:${userId}:${role}`;

export const buildBadgeCacheKey = ({ userId, role }: CacheIdentity): string =>
  `${BADGE_CACHE_PREFIX}:${userId}:${role}`;

export function readNavigationCache(identity: CacheIdentity): NavigationPayload | null {
  const key = buildNavigationCacheKey(identity);
  const raw = safeRead(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isNavigationCacheRecord(parsed)) {
      safeRemove(key);
      return null;
    }

    if (parsed.role !== identity.role || isExpired(parsed.timestamp, NAVIGATION_CACHE_TTL_MS)) {
      safeRemove(key);
      return null;
    }

    return parsed.data;
  } catch {
    safeRemove(key);
    return null;
  }
}

export function writeNavigationCache(identity: CacheIdentity, data: NavigationPayload): void {
  const key = buildNavigationCacheKey(identity);
  const payload: NavigationCacheRecord = {
    data,
    role: identity.role,
    timestamp: Date.now(),
  };

  safeWrite(key, JSON.stringify(payload));
}

export function clearNavigationCache(identity: CacheIdentity): void {
  safeRemove(buildNavigationCacheKey(identity));
}

export function readBadgeCache(identity: CacheIdentity): BadgeCounts | null {
  const key = buildBadgeCacheKey(identity);
  const raw = safeRead(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isBadgeCacheRecord(parsed)) {
      safeRemove(key);
      return null;
    }

    if (parsed.role !== identity.role || isExpired(parsed.timestamp, BADGE_CACHE_TTL_MS)) {
      safeRemove(key);
      return null;
    }

    return parsed.data;
  } catch {
    safeRemove(key);
    return null;
  }
}

export function writeBadgeCache(identity: CacheIdentity, data: BadgeCounts): void {
  const key = buildBadgeCacheKey(identity);
  const payload: BadgeCacheRecord = {
    data,
    role: identity.role,
    timestamp: Date.now(),
  };

  safeWrite(key, JSON.stringify(payload));
}

export function clearBadgeCache(identity: CacheIdentity): void {
  safeRemove(buildBadgeCacheKey(identity));
}
