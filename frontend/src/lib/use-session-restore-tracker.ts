/**
 * Location: src/lib/use-session-restore-tracker.ts
 * Purpose: Expose overlapping live-session restore flights to React consumers.
 * Why: Protected routes must stay loading until every joined revalidation settles.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSessionRestoreTracker() {
  const [activeFlightCount, setActiveFlightCount] = useState(0);
  const activeFlights = useRef(new Set<symbol>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeFlights.current.clear();
    };
  }, []);

  const trackSessionRestore = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      const flight = Symbol('session-restore');
      activeFlights.current.add(flight);
      if (mounted.current) setActiveFlightCount(activeFlights.current.size);
      try {
        return await operation();
      } finally {
        activeFlights.current.delete(flight);
        if (mounted.current) setActiveFlightCount(activeFlights.current.size);
      }
    },
    [],
  );

  return {
    isSessionRestoreActive: activeFlightCount > 0,
    trackSessionRestore,
  };
}
