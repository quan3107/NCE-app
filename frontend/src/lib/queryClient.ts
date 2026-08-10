/**
 * Location: src/lib/queryClient.ts
 * Purpose: Configure the shared React Query client instance for the frontend app.
 * Why: Centralizes cache and retry defaults for API-backed hooks.
 */

import { hashKey, QueryClient } from "@tanstack/react-query";

import { getAuthenticatedQueryScope } from "./authenticated-query-scope";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: (queryKey) =>
        hashKey([...getAuthenticatedQueryScope(), ...queryKey]),
      retry: 0,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});
