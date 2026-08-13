/**
 * Location: tests/profile.component.test.tsx
 * Purpose: Verify controlled profile editing, session refresh, and save ordering.
 * Why: Profile saves must update both persisted data and the visible authenticated user.
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
const logout = vi.hoisted(() => vi.fn(async () => undefined));
const authState = vi.hoisted(() => ({
  currentUser: {
    id: "user-1",
    name: "Original Name",
    email: "student@example.com",
    role: "student" as const,
  },
  sessionGeneration: 1,
}));
const profileState = vi.hoisted(() => ({
  fullName: "Original Name",
  profileRevision: 0,
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: authState.currentUser,
    sessionGeneration: authState.sessionGeneration,
    logout,
  }),
}));

vi.mock("@features/profile/api", () => ({
  meProfileQueryKey: (userId: string) => ["identity", userId, "profile"],
  useMeProfileQuery: () => ({
    data: {
      id: authState.currentUser.id,
      fullName:
        profileState.profileRevision > 0 &&
        authState.currentUser.id === "user-1"
          ? profileState.fullName
          : authState.currentUser.name,
      email: authState.currentUser.email,
      role: authState.currentUser.role,
      status: "active",
      profileRevision: profileState.profileRevision,
    },
  }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: async (payload: { fullName: string }) => {
      const saved = await saveProfile(payload);
      if (saved.profileRevision >= profileState.profileRevision) {
        profileState.fullName = saved.fullName;
        profileState.profileRevision = saved.profileRevision;
      }
      return {
        ...saved,
        fullName: profileState.fullName,
        profileRevision: profileState.profileRevision,
      };
    },
    isPending: false,
    error: null,
  }),
}));

const { ProfileDetailsCard } =
  await import("../src/features/profile/components/ProfileDetailsCard");

beforeEach(() => {
  authState.currentUser = {
    id: "user-1",
    name: "Original Name",
    email: "student@example.com",
    role: "student",
  };
  authState.sessionGeneration = 1;
  profileState.fullName = "Original Name";
  profileState.profileRevision = 0;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("submits the controlled name and updates the authenticated user", async () => {
  saveProfile.mockResolvedValueOnce({
    id: "user-1",
    fullName: "Updated Name",
    email: "student@example.com",
    role: "student",
    status: "active",
    profileRevision: 1,
  });
  render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: " Updated Name " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => {
    assert.deepEqual(saveProfile.mock.calls[0]?.[0], {
      fullName: "Updated Name",
    });
    assert.equal(
      screen.getByRole("button", { name: "Edit Profile" }).textContent,
      "Edit Profile",
    );
  });
});

test("ignores a late save after the authenticated account changes", async () => {
  let resolveSave!: (profile: {
    id: string;
    fullName: string;
    email: string;
    role: "student";
    status: "active";
    profileRevision: number;
  }) => void;
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

  authState.currentUser = {
    id: "user-2",
    name: "User B",
    email: "user-b@example.com",
    role: "student",
  };
  authState.sessionGeneration = 2;
  view.rerender(<ProfileDetailsCard />);

  await act(async () => {
    resolveSave({
      id: "user-1",
      fullName: "User A Name",
      email: "student@example.com",
      role: "student",
      status: "active",
      profileRevision: 1,
    });
  });

  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "User B",
  );
});

test("ignores an older completion when saves resolve in reverse order", async () => {
  const resolvers: Array<
    (profile: {
      id: string;
      fullName: string;
      email: string;
      role: "student";
      status: "active";
      profileRevision: number;
    }) => void
  > = [];
  saveProfile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
  );
  render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "First Save" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Save Changes" }).closest("form")!,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Second Save" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Save Changes" }).closest("form")!,
  );

  await act(async () => {
    resolvers[1]?.({
      id: "user-1",
      fullName: "Second Save",
      email: "student@example.com",
      role: "student",
      status: "active",
      profileRevision: 2,
    });
  });
  await act(async () => {
    resolvers[0]?.({
      id: "user-1",
      fullName: "First Save",
      email: "student@example.com",
      role: "student",
      status: "active",
      profileRevision: 1,
    });
  });

  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "Second Save",
  );
});

test("synchronizes refreshed names without overwriting a dirty edit", () => {
  const view = render(<ProfileDetailsCard />);

  authState.currentUser = { ...authState.currentUser, name: "Refreshed Name" };
  authState.sessionGeneration = 2;
  view.rerender(<ProfileDetailsCard />);
  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "Refreshed Name",
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Dirty Draft" },
  });
  authState.currentUser = { ...authState.currentUser, name: "New Server Name" };
  authState.sessionGeneration = 3;
  view.rerender(<ProfileDetailsCard />);
  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "Dirty Draft",
  );

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "New Server Name",
  );
});

test("Cancel keeps a newer peer name when an older PATCH resolves later", async () => {
  let resolveSave!: (profile: {
    id: string;
    fullName: string;
    email: string;
    role: "student";
    status: "active";
    profileRevision: number;
  }) => void;
  saveProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSave = resolve;
    }),
  );
  const view = render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Delayed Save" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => assert.equal(saveProfile.mock.calls.length, 1));

  profileState.fullName = "Peer Winner";
  profileState.profileRevision = 2;
  view.rerender(<ProfileDetailsCard />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await act(async () => {
    resolveSave({
      id: "user-1",
      fullName: "Delayed Save",
      email: "student@example.com",
      role: "student",
      status: "active",
      profileRevision: 1,
    });
  });

  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "Peer Winner",
  );
});
