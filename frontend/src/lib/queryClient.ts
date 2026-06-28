/**
 * Location: src/lib/queryClient.ts
 * Purpose: Configure the shared React Query client instance for the frontend app.
 * Why: Centralizes cache and retry defaults for API-backed hooks.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});
