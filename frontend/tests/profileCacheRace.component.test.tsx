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
import { AuthCoordinator } from "../src/lib/auth-coordinator";
import { authBridge } from "../src/lib/authBridge";
import { queryClient } from "../src/lib/queryClient";

afterEach(() => {
  cleanup();
  queryClient.clear();
  authBridge.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("an older profile fetch cannot overwrite a successful save", async () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate("student-token", {
    id: "user-1",
    role: "student",
  });
  authBridge.configure({
    admit: (mode) => coordinator.admit(mode),
    getSnapshot: () => coordinator.getSnapshot(),
    isCurrent: (value) => coordinator.isCurrent(value),
    waitUntilReady: () => coordinator.waitUntilReady(),
  });
  const queryKey = meProfileQueryKey("user-1");
  queryClient.setQueryData(queryKey, {
    id: "user-1",
    email: "student@example.com",
    fullName: "Original Name",
    role: "student",
    status: "active",
    profileRevision: 0,
  });
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
        profileRevision: 1,
      }),
    ),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mutation = renderHook(() => useUpdateMeProfileMutation("user-1"), {
    wrapper,
  });

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

test("a role transition during cache cancellation rejects the old PATCH owner", async () => {
  const storageValues = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storageValues.get(key) ?? null,
      setItem: (key: string, value: string) => storageValues.set(key, value),
    },
  });
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate("student-token", {
    id: "user-1",
    role: "student",
  });
  authBridge.configure({
    admit: (mode) => coordinator.admit(mode),
    getSnapshot: () => coordinator.getSnapshot(),
    isCurrent: (value) => coordinator.isCurrent(value),
    waitUntilReady: () => coordinator.waitUntilReady(),
  });
  const queryKey = meProfileQueryKey("user-1");
  queryClient.setQueryData(queryKey, {
    id: "user-1",
    fullName: "Student Name",
    email: "student@example.com",
    role: "student",
    status: "active",
    profileRevision: 0,
  });
  let releaseCancellation!: () => void;
  let cancellationStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    cancellationStarted = resolve;
  });
  vi.spyOn(queryClient, "cancelQueries").mockImplementation(async () => {
    cancellationStarted();
    await new Promise<void>((resolve) => {
      releaseCancellation = resolve;
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        id: "user-1",
        email: "student@example.com",
        fullName: "Saved Student Name",
        role: "student",
        status: "active",
        profileRevision: 1,
      }),
    ),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mutation = renderHook(() => useUpdateMeProfileMutation("user-1"), {
    wrapper,
  });

  let save!: Promise<unknown>;
  act(() => {
    save = mutation.result.current.mutateAsync({
      fullName: "Saved Student Name",
    });
  });
  await started;
  coordinator.authenticate("teacher-token", {
    id: "user-1",
    role: "teacher",
  });
  releaseCancellation();
  await act(async () => {
    await assert.rejects(save, /ownership changed/i);
  });

  assert.notEqual(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Saved Student Name",
  );
  assert.equal(
    window.localStorage.getItem("nce:auth-profile-invalidation"),
    null,
  );
});

test("a delayed older PATCH response cannot overwrite a newer profile revision", async () => {
  const coordinator = new AuthCoordinator();
  coordinator.finishBootstrap();
  coordinator.authenticate("student-token", { id: "user-1", role: "student" });
  authBridge.configure({
    admit: (mode) => coordinator.admit(mode),
    getSnapshot: () => coordinator.getSnapshot(),
    isCurrent: (value) => coordinator.isCurrent(value),
    waitUntilReady: () => coordinator.waitUntilReady(),
  });
  const queryKey = meProfileQueryKey("user-1");
  queryClient.setQueryData(queryKey, {
    id: "user-1",
    email: "student@example.com",
    fullName: "Original Name",
    role: "student",
    status: "active",
    profileRevision: 0,
  });
  let resolveFirst!: (response: Response) => void;
  const requests: Array<{ fullName: string; expectedRevision: number }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        fullName: string;
        expectedRevision: number;
      };
      requests.push(body);
      if (body.fullName === "First Save") {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Response.json({
        id: "user-1",
        email: "student@example.com",
        fullName: "Second Save",
        role: "student",
        status: "active",
        profileRevision: 2,
      });
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mutation = renderHook(() => useUpdateMeProfileMutation("user-1"), {
    wrapper,
  });

  const first = mutation.result.current.mutateAsync({ fullName: "First Save" });
  await vi.waitFor(() => assert.equal(requests.length, 1));
  queryClient.setQueryData(queryKey, {
    id: "user-1",
    email: "student@example.com",
    fullName: "First Save",
    role: "student",
    status: "active",
    profileRevision: 1,
  });
  await mutation.result.current.mutateAsync({ fullName: "Second Save" });
  resolveFirst(
    Response.json({
      id: "user-1",
      email: "student@example.com",
      fullName: "First Save",
      role: "student",
      status: "active",
      profileRevision: 1,
    }),
  );
  const firstResult = await first;

  assert.deepEqual(requests, [
    { fullName: "First Save", expectedRevision: 0 },
    { fullName: "Second Save", expectedRevision: 1 },
  ]);
  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Second Save",
  );
  assert.equal(firstResult.fullName, "Second Save");
});
