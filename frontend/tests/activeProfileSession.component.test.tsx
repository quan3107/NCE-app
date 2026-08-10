/**
 * Location: tests/activeProfileSession.component.test.tsx
 * Purpose: Verify the authenticated session globally owns its authoritative profile query.
 * Why: Leaving the profile page must not evict names or stop peer invalidation refetches.
 */

import assert from "node:assert/strict";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { meProfileQueryKey } from "../src/features/profile/api";
import { startActiveProfileSession } from "../src/lib/active-profile-session";
import type { CurrentProfile } from "../src/lib/auth-types";
import { setAuthenticatedQueryScope } from "../src/lib/authenticated-query-scope";
import { queryClient } from "../src/lib/queryClient";
import { useAuthRuntime } from "../src/lib/use-auth-runtime";

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
  setAuthenticatedQueryScope({ generation: 0, userId: null });
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

test("same-user role transition owns the new authorization-scope profile", async () => {
  const student = {
    id: "user-a",
    email: "user-a@example.com",
    fullName: "Student Name",
    role: "student" as const,
  };
  const teacher = {
    ...student,
    fullName: "Teacher Name",
    role: "teacher" as const,
  };
  const profiles = [
    { ...student, status: "active" },
    { ...teacher, status: "active" },
    { ...teacher, fullName: "Peer Teacher Name", status: "active" },
  ];
  let profileRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        return Response.json({ accessToken: "student-token", user: student });
      }
      if (path.endsWith("/me")) {
        const next = profiles[profileRequests] ?? profiles.at(-1);
        profileRequests += 1;
        return Response.json({ profile: next });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  const runtime = renderHook(() => useAuthRuntime());
  await waitFor(() => assert.equal(profileRequests, 1));

  act(() => {
    const expected = runtime.result.current.coordinator.getSnapshot();
    assert.equal(
      runtime.result.current.applyLiveSession(
        { accessToken: "teacher-token", user: teacher },
        expected,
      ),
      true,
    );
  });

  await waitFor(() => assert.equal(profileRequests, 2));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    queryClient.getQueryData<CurrentProfile>(meProfileQueryKey("user-a"))
      ?.role,
    "teacher",
  );
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: JSON.stringify({
        type: "profile-invalidated",
        userId: "user-a",
        publicationId: "peer-role-change:1",
      }),
    }),
  );
  await waitFor(() =>
    assert.equal(
      queryClient.getQueryData<CurrentProfile>(meProfileQueryKey("user-a"))
        ?.fullName,
      "Peer Teacher Name",
    ),
  );
  runtime.unmount();
});
