/**
 * Location: lib/useMutationLifetime.ts
 * Purpose: Fence async UI callbacks to the mounted route and initiating session.
 * Why: A completed server write must not navigate or edit a later user's screen.
 */
import { useEffect, useRef } from "react";
import { getAuthenticatedQueryScope } from "./authenticated-query-scope";

export function useMutationLifetime() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return () => {
    const scope = JSON.stringify(getAuthenticatedQueryScope());
    const route = window.location.href;
    return () =>
      mounted.current &&
      window.location.href === route &&
      JSON.stringify(getAuthenticatedQueryScope()) === scope;
  };
}
