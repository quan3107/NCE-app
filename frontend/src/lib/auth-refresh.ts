/**
 * Location: src/lib/auth-refresh.ts
 * Purpose: Keep refresh race decisions independent from React state.
 * Why: A stale failed refresh must not clear a newer live session.
 */

export const shouldClearSessionAfterRefreshFailure = (
  tokenAtRefreshStart: string | null,
  currentToken: string | null,
) => currentToken === tokenAtRefreshStart;
