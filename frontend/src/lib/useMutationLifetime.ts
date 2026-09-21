/**
 * Location: lib/useMutationLifetime.ts
 * Purpose: Fence async UI callbacks to the mounted route and initiating session.
 * Why: A completed server write must not navigate or edit a later user's screen.
 */
import { useContext, useEffect, useRef } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";
import { getAuthenticatedQueryScope } from "./authenticated-query-scope";

export function useMutationLifetime() {
  const locationContext = useContext(UNSAFE_LocationContext);
  const navigation = `${locationContext?.location.key ?? ""}:${window.location.href}`;
  const routeVersion = useRef({ navigation, generation: 0 });
  if (routeVersion.current.navigation !== navigation) {
    routeVersion.current = {
      navigation,
      generation: routeVersion.current.generation + 1,
    };
  }
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
    const generation = routeVersion.current.generation;
    let abandoned = false;
    return () => {
      // Once abandoned, revisiting the same URL cannot revive this operation.
      abandoned ||=
        !mounted.current ||
        routeVersion.current.generation !== generation ||
        window.location.href !== route ||
        JSON.stringify(getAuthenticatedQueryScope()) !== scope;
      return !abandoned;
    };
  };
}
