/**
 * Location: features/grades/objectiveExplanationMemory.ts
 * Purpose: Remember which objective explanations a student requested in this tab.
 * Why: Reload restoration should recheck only relevant backend records without storing feedback.
 */

const storageKey = (userId: string) =>
  `nce:objective-explanations:${userId}`;

export function readRememberedExplanationKeys(userId: string): Set<string> {
  try {
    const value = window.sessionStorage.getItem(storageKey(userId));
    const parsed: unknown = value ? JSON.parse(value) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter(
            (item): item is string =>
              typeof item === 'string' && item.length > 0 && item.length <= 200,
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

export function rememberExplanationKey(userId: string, key: string) {
  try {
    const remembered = readRememberedExplanationKeys(userId);
    remembered.add(key);
    window.sessionStorage.setItem(
      storageKey(userId),
      JSON.stringify([...remembered]),
    );
  } catch {
    // Reload restoration is optional when browser storage is unavailable.
  }
}
