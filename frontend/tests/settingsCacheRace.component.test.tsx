/**
 * Location: tests/settingsCacheRace.component.test.tsx
 * Purpose: Verify a late settings GET cannot overwrite a successful PATCH.
 * Why: Saved values and optimistic-concurrency baselines must remain authoritative.
 */
import assert from "node:assert/strict";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, test, vi } from "vitest";

import {
  adminUploadLimitsQueryKey,
  fetchAdminUploadLimits,
  useUpdateAdminUploadLimitsMutation,
} from "../src/features/admin/settingsApi";
import { queryClient } from "../src/lib/queryClient";

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("an old GET resolving after PATCH success cannot restore stale settings", async () => {
  let getSignal: AbortSignal | undefined;
  let resolveGet!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              limits: [
                { role: "student", maxFileSizeMb: 12 },
                { role: "teacher", maxFileSizeMb: 25 },
                { role: "admin", maxFileSizeMb: 25 },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }
      return new Promise<Response>((resolve) => {
        getSignal = init?.signal ?? undefined;
        resolveGet = resolve;
      });
    }),
  );

  const oldGet = queryClient.fetchQuery({
    queryKey: adminUploadLimitsQueryKey,
    queryFn: ({ signal }) => fetchAdminUploadLimits(signal),
  });
  const settledOldGet = oldGet.catch(() => undefined);
  await waitFor(() => assert.equal(typeof resolveGet, "function"));
  const { result } = renderHook(() => useUpdateAdminUploadLimitsMutation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  await act(async () => {
    await result.current.mutateAsync({
      updates: {
        student: {
          expectedMaxFileSizeMb: 25,
          maxFileSizeMb: 12,
        },
      },
    });
  });

  assert.equal(getSignal?.aborted, true);
  resolveGet(
    new Response(
      JSON.stringify({
        limits: [
          { role: "student", maxFileSizeMb: 25 },
          { role: "teacher", maxFileSizeMb: 25 },
          { role: "admin", maxFileSizeMb: 25 },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
  );
  await settledOldGet;

  assert.equal(
    queryClient.getQueryData<{
      limits: Array<{ role: string; maxFileSizeMb: number }>;
    }>(adminUploadLimitsQueryKey)?.limits[0]?.maxFileSizeMb,
    12,
  );
});
