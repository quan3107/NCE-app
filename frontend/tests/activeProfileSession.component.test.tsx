/**
 * Location: tests/activeProfileSession.component.test.tsx
 * Purpose: Verify the authenticated session globally owns its authoritative profile query.
 * Why: Leaving the profile page must not evict names or stop peer invalidation refetches.
 */

import assert from "node:assert/strict";

import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { meProfileQueryKey } from "../src/features/profile/api";
import { startActiveProfileSession } from "../src/lib/active-profile-session";
import type { CurrentProfile } from "../src/lib/auth-types";
import { queryClient } from "../src/lib/queryClient";

const values = new Map<string, string>();
const profile = (fullName: string): CurrentProfile => ({
  id: "user-a",
  email: "user-a@example.com",
  fullName,
  role: "student",
  status: "active",
});

beforeEach(() => {
  values.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("the active session retains profile cache without a profile page observer", async () => {
  queryClient.setQueryData(meProfileQueryKey("user-a"), profile("Seed Name"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ profile: profile("Server Name") })),
  );

  const stop = startActiveProfileSession("user-a", () => undefined);
  await waitFor(() =>
    assert.equal(
      queryClient.getQueryData<CurrentProfile>(meProfileQueryKey("user-a"))
        ?.fullName,
      "Server Name",
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    queryClient.getQueryData<CurrentProfile>(meProfileQueryKey("user-a"))
      ?.fullName,
    "Server Name",
  );
  stop();
});

test("profile invalidation refetches while no profile page is mounted", async () => {
  const fetchProfile = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ profile: profile("Initial Name") }))
    .mockResolvedValueOnce(Response.json({ profile: profile("Peer Name") }));
  vi.stubGlobal("fetch", fetchProfile);
  const stop = startActiveProfileSession("user-a", () => undefined);
  await waitFor(() => assert.equal(fetchProfile.mock.calls.length, 1));

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: JSON.stringify({
        type: "profile-invalidated",
        userId: "user-a",
        publicationId: "peer:1",
      }),
    }),
  );

  await waitFor(() => assert.equal(fetchProfile.mock.calls.length, 2));
  await waitFor(() =>
    assert.equal(
      queryClient.getQueryData<CurrentProfile>(meProfileQueryKey("user-a"))
        ?.fullName,
      "Peer Name",
    ),
  );
  stop();
});

test("a terminal profile response ends the active session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ message: "Profile unavailable" }, { status: 404 }),
    ),
  );
  const onTerminal = vi.fn();
  const stop = startActiveProfileSession("user-a", onTerminal);

  await waitFor(() => assert.equal(onTerminal.mock.calls.length, 1));
  stop();
});
