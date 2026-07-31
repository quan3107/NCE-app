/**
 * Location: src/lib/browser-storage.ts
 * Purpose: Provide exception-safe access to optional browser persistence.
 * Why: Privacy settings and quota failures must not break live authentication.
 */

export function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sessionStorageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function storageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(
  storage: Storage,
  key: string,
  value: string,
): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Removal is best-effort when browser persistence is unavailable.
  }
}

export function storageKeys(storage: Storage): string[] {
  try {
    return Object.keys(storage);
  } catch {
    return [];
  }
}
