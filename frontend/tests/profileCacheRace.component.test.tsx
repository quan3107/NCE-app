/**
 * Location: tests/profileCacheRace.component.test.tsx
 * Purpose: Verify authoritative profile saves cancel older profile fetches.
 * Why: A response started before a save must not restore stale identity data.
 */
import assert from "node:assert/strict";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { queryClient } from "../src/lib/queryClient";

const saveProfile = vi.hoisted(() => vi.fn());
const updateCurrentUser = vi.hoisted(() => vi.fn(() => true));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "user-1",
      name: "Old Name",
      email: "student@example.com",
      role: "student",
    },
    sessionGeneration: 1,
    updateCurrentUser,
  }),
}));

vi.mock("@features/profile/api", () => ({
  meProfileQueryKey: (userId: string) => ["identity", userId, "profile"],
  useMeProfileQuery: () => ({
    data: {
      id: "user-1",
      email: "student@example.com",
      fullName: "Old Name",
      role: "student",
      status: "active",
    },
  }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: saveProfile,
    isPending: false,
  }),
}));

const { ProfileDetailsCard } = await import(
  "../src/features/profile/components/ProfileDetailsCard"
);

beforeEach(() => {
  saveProfile.mockResolvedValue({
    id: "user-1",
    email: "student@example.com",
    fullName: "Saved Name",
    role: "student",
    status: "active",
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.clearAllMocks();
});

test("an older profile fetch cannot overwrite a successful save", async () => {
  const queryKey = ["identity", "user-1", "profile"] as const;
  queryClient.setQueryData(queryKey, {
    id: "user-1",
    fullName: "Old Name",
  });
  let requestSignal: AbortSignal | undefined;
  let resolveRequest!: (profile: { id: string; fullName: string }) => void;
  const oldRequest = queryClient.fetchQuery({
    queryKey,
    queryFn: ({ signal }) =>
      new Promise<{ id: string; fullName: string }>((resolve) => {
        requestSignal = signal;
        resolveRequest = resolve;
      }),
  });
  const settledOldRequest = oldRequest.catch(() => undefined);
  render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Saved Name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => assert.equal(saveProfile.mock.calls.length, 1));
  assert.equal(requestSignal?.aborted, true);
  resolveRequest({ id: "user-1", fullName: "Old Name" });
  await settledOldRequest;

  assert.equal(
    queryClient.getQueryData<{ fullName: string }>(queryKey)?.fullName,
    "Saved Name",
  );
});
