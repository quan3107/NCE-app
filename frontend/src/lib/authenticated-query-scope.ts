/**
 * Location: src/lib/authenticated-query-scope.ts
 * Purpose: Namespace shared query hashes by the active authentication identity.
 * Why: Identical actor-scoped keys must never alias across account generations.
 */

type AuthenticatedQueryScope = {
  generation: number;
  userId: string | null;
};

let activeScope: AuthenticatedQueryScope = {
  generation: 0,
  userId: null,
};

export function setAuthenticatedQueryScope(
  scope: AuthenticatedQueryScope,
): void {
  activeScope = { ...scope };
}

export function getAuthenticatedQueryScope(): readonly [
  "auth-session",
  string,
  number,
] {
  return [
    "auth-session",
    activeScope.userId ?? "anonymous",
    activeScope.generation,
  ];
}
