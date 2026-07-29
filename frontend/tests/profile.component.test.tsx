/**
 * Location: tests/profile.component.test.tsx
 * Purpose: Verify controlled profile editing, inline validation, and session refresh.
 * Why: Profile saves must update both persisted data and the visible authenticated user.
 */
import assert from "node:assert/strict";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

const saveProfile = vi.hoisted(() => vi.fn());
const updateCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "user-1",
      name: "Original Name",
      email: "student@example.com",
      role: "student",
    },
    updateCurrentUser,
  }),
}));

vi.mock("@features/profile/api", () => ({
  useUpdateMeProfileMutation: () => ({
    mutateAsync: saveProfile,
    isPending: false,
    error: null,
  }),
}));

const { ProfileDetailsCard } = await import(
  "../src/features/profile/components/ProfileDetailsCard"
);

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
    assert.deepEqual(updateCurrentUser.mock.calls[0]?.[0], {
      name: "Updated Name",
    });
  });
});
