/**
 * Location: tests/profile.component.test.tsx
 * Purpose: Verify controlled profile editing, inline validation, and session refresh.
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
const commitCurrentProfile = vi.hoisted(() => vi.fn());
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

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: authState.currentUser,
    sessionGeneration: authState.sessionGeneration,
    commitCurrentProfile,
    logout,
  }),
}));

vi.mock("@features/profile/api", () => ({
  meProfileQueryKey: (userId: string) => ["identity", userId, "profile"],
  useMeProfileQuery: () => ({
    data: {
      id: authState.currentUser.id,
      fullName: authState.currentUser.name,
      email: authState.currentUser.email,
      role: authState.currentUser.role,
      status: "active",
    },
  }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: saveProfile,
    isPending: false,
    error: null,
  }),
}));

const { ProfileDetailsCard } = await import(
  "../src/features/profile/components/ProfileDetailsCard"
);

beforeEach(() => {
  authState.currentUser = {
    id: "user-1",
    name: "Original Name",
    email: "student@example.com",
    role: "student",
  };
  authState.sessionGeneration = 1;
  commitCurrentProfile.mockImplementation(
    (
      expected: { userId: string; generation: number },
      profile: { id: string; fullName: string },
    ) => {
      if (
        expected.userId !== authState.currentUser.id ||
        expected.generation !== authState.sessionGeneration ||
        profile.id !== authState.currentUser.id
      ) {
        return false;
      }
      authState.currentUser = {
        ...authState.currentUser,
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

test("shows inline name errors without sending invalid profile data", () => {
  render(<ProfileDetailsCard />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  assert.ok(
    screen.getByText("Name must be between 2 and 100 characters."),
  );
  assert.equal(saveProfile.mock.calls.length, 0);
});

test("submits the controlled name and updates the authenticated user", async () => {
  saveProfile.mockResolvedValueOnce({
    id: "user-1",
    fullName: "Updated Name",
    email: "student@example.com",
    role: "student",
    status: "active",
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
    assert.deepEqual(commitCurrentProfile.mock.calls[0]?.[0], {
      userId: "user-1",
      generation: 1,
    });
    assert.equal(
      commitCurrentProfile.mock.calls[0]?.[1]?.fullName,
      "Updated Name",
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
    });
  });

  assert.equal(await commitCurrentProfile.mock.results.at(-1)?.value, false);
  assert.equal((screen.getByLabelText("Name") as HTMLInputElement).value, "User B");
});

test("ignores an older completion when saves resolve in reverse order", async () => {
  const resolvers: Array<
    (profile: {
      id: string;
      fullName: string;
      email: string;
      role: "student";
      status: "active";
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
  fireEvent.submit(screen.getByRole("button", { name: "Save Changes" }).closest("form")!);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Second Save" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save Changes" }).closest("form")!);

  await act(async () => {
    resolvers[1]?.({
      id: "user-1",
      fullName: "Second Save",
      email: "student@example.com",
      role: "student",
      status: "active",
    });
  });
  await act(async () => {
    resolvers[0]?.({
      id: "user-1",
      fullName: "First Save",
      email: "student@example.com",
      role: "student",
      status: "active",
    });
  });

  assert.equal(commitCurrentProfile.mock.calls.length, 1);
  assert.equal(
    commitCurrentProfile.mock.calls[0]?.[1]?.fullName,
    "Second Save",
  );
  assert.equal((screen.getByLabelText("Name") as HTMLInputElement).value, "Second Save");
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
  assert.equal((screen.getByLabelText("Name") as HTMLInputElement).value, "Dirty Draft");

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  assert.equal(
    (screen.getByLabelText("Name") as HTMLInputElement).value,
    "New Server Name",
  );
});

test("counts astral profile names by Unicode code point", async () => {
  saveProfile.mockImplementation(async ({ fullName }: { fullName: string }) => ({
    id: "user-1",
    fullName,
    email: "student@example.com",
    role: "student",
    status: "active",
  }));
  render(<ProfileDetailsCard />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));

  for (const invalidName of ["😀", "😀".repeat(101)]) {
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: invalidName },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  }
  assert.equal(saveProfile.mock.calls.length, 0);

  for (const validName of ["😀😀", "😀".repeat(100)]) {
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: validName },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => {
      assert.equal(
        saveProfile.mock.calls.at(-1)?.[0]?.fullName,
        validName,
      );
    });
    if (validName.length < 100) {
      fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    }
  }
});
