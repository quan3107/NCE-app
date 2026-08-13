/**
 * Location: src/lib/use-active-profile-runtime.ts
 * Purpose: Bind authoritative profile observation to the active auth scope.
 * Why: Role/revision ownership and terminal logout need one focused lifecycle.
 */
import { useEffect } from "react";

import { apiClient } from "./apiClient";
import { startActiveProfileSession } from "./active-profile-session";
import type { AuthCookieOperations } from "./auth-cookie-operations";
import type { AuthMachineState } from "./auth-machine";
import type { AuthInvalidationReason } from "./shared-auth-session";

type ClearSession = (reason?: AuthInvalidationReason) => void;

export function useActiveProfileRuntime(
  snapshot: AuthMachineState,
  cookieOperations: AuthCookieOperations,
  clearSession: ClearSession,
): void {
  const activeUserId =
    snapshot.status === "authenticated" ? snapshot.actor.id : "";
  const activeUserRole =
    snapshot.status === "authenticated" ? snapshot.actor.role : "";

  useEffect(() => {
    if (snapshot.status !== "authenticated") return;
    return startActiveProfileSession(
      {
        userId: snapshot.actor.id,
        role: snapshot.actor.role,
        revision: snapshot.revision,
      },
      () => {
        cookieOperations.cancelRefreshes();
        clearSession("logout");
        void cookieOperations
          .run((signal) =>
            apiClient("/auth/logout", {
              auth: "none",
              method: "POST",
              credentials: "include",
              parseJson: false,
              signal,
            }),
          )
          .catch(() => undefined);
      },
    );
  }, [
    activeUserId,
    activeUserRole,
    clearSession,
    cookieOperations,
    snapshot.revision,
  ]);
}
