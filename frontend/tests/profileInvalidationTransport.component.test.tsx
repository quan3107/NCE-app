/**
 * Location: tests/profileInvalidationTransport.component.test.tsx
 * Purpose: Verify profile invalidations are identity-only, ordered notifications.
 * Why: Peer tabs must refetch /me without receiving profile or auth authority.
 */

import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { useMeProfileQuery } from "../src/features/profile/api";
import { queryClient } from "../src/lib/queryClient";
import {
  publishProfileInvalidation,
  subscribeToProfileInvalidation,
} from "../src/lib/shared-profile-invalidation";

const values = new Map<string, string>();

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
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

test("a storage event requests a peer refetch by user id only", () => {
  const received: unknown[] = [];
  const unsubscribe = subscribeToProfileInvalidation((message) => {
    received.push(message);
  });
  const message = {
    type: "profile-invalidated",
    userId: "user-a",
    publicationId: "tab-a:1",
  };
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: JSON.stringify(message),
    }),
  );
  unsubscribe();

  assert.deepEqual(received, [message]);
  assert.doesNotMatch(JSON.stringify(received), /"token"|"profile"|fullName/i);
});

test("a peer invalidation refetches the authoritative profile query", async () => {
  const fetchProfile = vi.fn(async () =>
    Response.json({
      profile: {
        id: "user-a",
        email: "user-a@example.com",
        fullName: "Authoritative Name",
        role: "student",
        status: "active",
      },
    }),
  );
  vi.stubGlobal("fetch", fetchProfile);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  renderHook(() => useMeProfileQuery("user-a"), { wrapper });
  await waitFor(() => assert.equal(fetchProfile.mock.calls.length, 1));

  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "nce:auth-profile-invalidation",
        newValue: JSON.stringify({
          type: "profile-invalidated",
          userId: "user-a",
          publicationId: "tab-peer:1",
        }),
      }),
    );
  });
  await waitFor(() => assert.equal(fetchProfile.mock.calls.length, 2));
});

test("duplicate transports deliver one profile invalidation", () => {
  const received: string[] = [];
  const unsubscribe = subscribeToProfileInvalidation((message) => {
    received.push(message.publicationId);
  });
  const serialized = JSON.stringify({
    type: "profile-invalidated",
    userId: "user-a",
    publicationId: "tab-duplicate:1",
  });
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: serialized,
    }),
  );
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: serialized,
    }),
  );
  unsubscribe();
  assert.deepEqual(received, ["tab-duplicate:1"]);
});

test("subscription catches up after listeners attach", () => {
  window.localStorage.setItem(
    "nce:auth-profile-invalidation",
    JSON.stringify({
      type: "profile-invalidated",
      userId: "user-between-read-and-subscribe",
      publicationId: "tab-b:1",
    }),
  );
  const received: string[] = [];
  const unsubscribe = subscribeToProfileInvalidation((message) => {
    received.push(message.userId);
  });
  unsubscribe();
  assert.deepEqual(received, ["user-between-read-and-subscribe"]);
});

test("storage read failure does not prevent profile invalidation subscription", () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: () => {
        throw new Error("storage read denied");
      },
      setItem: () => undefined,
    },
  });
  const received: string[] = [];
  const unsubscribe = subscribeToProfileInvalidation((message) => {
    received.push(message.userId);
  });
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "nce:auth-profile-invalidation",
      newValue: JSON.stringify({
        type: "profile-invalidated",
        userId: "user-after-storage-failure",
        publicationId: "tab-c:1",
      }),
    }),
  );
  unsubscribe();
  assert.deepEqual(received, ["user-after-storage-failure"]);
});

test("published invalidations contain no profile snapshot", () => {
  publishProfileInvalidation({ userId: "user-a" });
  const stored = window.localStorage.getItem(
    "nce:auth-profile-invalidation",
  );
  assert.ok(stored);
  assert.match(stored, /"userId":"user-a"/);
  assert.doesNotMatch(stored, /"token"|"profile"|fullName|email|role/i);
});
