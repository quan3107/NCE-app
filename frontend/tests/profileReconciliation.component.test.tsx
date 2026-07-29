/**
 * Location: tests/profileReconciliation.component.test.tsx
 * Purpose: Verify GET and PATCH profile responses share guarded identity reconciliation.
 * Why: Draft actions and account switches must not desynchronize local and server identity.
 */
import assert from "node:assert/strict";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

const saveProfile = vi.hoisted(() => vi.fn());
const commitCurrentProfile = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  currentUser: {
    id: "user-1",
    name: "Original Name",
    email: "student@example.com",
    role: "student" as const,
  },
  generation: 1,
  profile: {
    id: "user-1",
    fullName: "Original Name",
    email: "student@example.com",
    role: "student" as const,
    status: "active" as const,
  },
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: state.currentUser,
    sessionGeneration: state.generation,
    commitCurrentProfile,
  }),
}));

vi.mock("@features/profile/api", () => ({
  useMeProfileQuery: () => ({ data: state.profile }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: saveProfile,
    isPending: false,
  }),
}));

const { ProfileDetailsCard } = await import(
  "../src/features/profile/components/ProfileDetailsCard"
);

beforeEach(() => {
  state.currentUser = {
    id: "user-1",
    name: "Original Name",
    email: "student@example.com",
    role: "student",
  };
  state.generation = 1;
  state.profile = {
    id: "user-1",
    fullName: "Original Name",
    email: "student@example.com",
    role: "student",
    status: "active",
  };
  commitCurrentProfile.mockImplementation(
    async (
      expected: { userId: string; generation: number },
      profile: typeof state.profile,
    ) => {
      if (
        expected.userId !== state.currentUser.id ||
        expected.generation !== state.generation ||
        profile.id !== state.currentUser.id
      ) {
        return false;
      }
      state.currentUser = {
        ...state.currentUser,
        name: profile.fullName,
      };
      return true;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("reconciles a fresh profile GET through the guarded commit path", async () => {
  const view = render(<ProfileDetailsCard />);
  commitCurrentProfile.mockClear();
  state.profile = { ...state.profile, fullName: "External Name" };

  view.rerender(<ProfileDetailsCard />);

  await waitFor(() => {
    assert.deepEqual(commitCurrentProfile.mock.calls.at(-1), [
      { userId: "user-1", generation: 1 },
      state.profile,
    ]);
  });
});

test("cancel during save does not discard the authoritative PATCH response", async () => {
  let resolveSave!: (profile: typeof state.profile) => void;
  saveProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSave = resolve;
    }),
  );
  render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Saved Name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await act(async () => {
    resolveSave({ ...state.profile, fullName: "Saved Name" });
  });

  await waitFor(() => {
    assert.equal(
      commitCurrentProfile.mock.calls.some(
        (call) => call[1]?.fullName === "Saved Name",
      ),
      true,
    );
    assert.equal(
      (screen.getByLabelText("Name") as HTMLInputElement).value,
      "Saved Name",
    );
  });
});

test("rejects a PATCH response after the account switches", async () => {
  let resolveSave!: (profile: typeof state.profile) => void;
  saveProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSave = resolve;
    }),
  );
  const view = render(<ProfileDetailsCard />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "User A Name" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  state.currentUser = {
    id: "user-2",
    name: "User B",
    email: "user-b@example.com",
    role: "student",
  };
  state.generation = 2;
  state.profile = {
    ...state.profile,
    id: "user-2",
    fullName: "User B",
    email: "user-b@example.com",
  };
  view.rerender(<ProfileDetailsCard />);

  await act(async () => {
    resolveSave({
      ...state.profile,
      id: "user-1",
      fullName: "User A Name",
      email: "student@example.com",
    });
  });

  const staleCallIndex = commitCurrentProfile.mock.calls.findIndex(
    (call) => call[1]?.id === "user-1" && call[1]?.fullName === "User A Name",
  );
  assert.notEqual(staleCallIndex, -1);
  assert.equal(
    await commitCurrentProfile.mock.results[staleCallIndex]?.value,
    false,
  );
  assert.equal((screen.getByLabelText("Name") as HTMLInputElement).value, "User B");
});
