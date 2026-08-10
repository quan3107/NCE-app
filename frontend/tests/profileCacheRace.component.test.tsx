/**
 * Location: tests/profileCacheRace.component.test.tsx
 * Purpose: Verify profile PATCH success cancels and supersedes older /me reads.
 * Why: A delayed response started before a save must not revert the authoritative cache.
 */

import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

import {
  meProfileQueryKey,
  useUpdateMeProfileMutation,
} from "../src/features/profile/api";
import { queryClient } from "../src/lib/queryClient";

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("an older profile fetch cannot overwrite a successful save", async () => {
  const queryKey = meProfileQueryKey("user-1");
  let requestSignal: AbortSignal | undefined;
  let resolveOldRequest!: (profile: { id: string; fullName: string }) => void;
  const oldRequest = queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) =>
      new Promise<{ id: string; fullName: string }>((resolve) => {
        requestSignal = signal;
        resolveOldRequest = resolve;
      }),
  });
  const settledOldRequest = oldRequest.catch(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        id: "user-1",
        email: "student@example.com",
        fullName: "Saved Name",
        role: "student",
        status: "active",
      }),
    ),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mutation = renderHook(
    () => useUpdateMeProfileMutation("user-1"),
    { wrapper },
  );

  await act(async () => {
    await mutation.result.current.mutateAsync({ fullName: "Saved Name" });
  });
  assert.equal(requestSignal?.aborted, true);
  resolveOldRequest({ id: "user-1", fullName: "Old Name" });
  await settledOldRequest;

  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Saved Name",
  );
});
