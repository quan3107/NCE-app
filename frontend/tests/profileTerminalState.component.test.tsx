/**
 * Location: tests/profileTerminalState.component.test.tsx
 * Purpose: Verify terminal profile responses end stale editable sessions.
 * Why: Suspended or deleted accounts must not look retryable in any role UI.
 */
import assert from "node:assert/strict";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { ApiError } from "../src/lib/apiClient";

const saveProfile = vi.hoisted(() => vi.fn());
const commitCurrentProfile = vi.hoisted(() => vi.fn());
const logout = vi.hoisted(() => vi.fn(async () => undefined));
const state = vi.hoisted(() => ({
  currentUser: {
    id: "user-1",
    name: "Original Name",
    email: "user@example.com",
    role: "student" as "admin" | "teacher" | "student",
  },
  queryError: null as unknown,
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: state.currentUser,
    sessionGeneration: 1,
    commitCurrentProfile,
    logout,
  }),
}));

vi.mock("@features/profile/api", () => ({
  useMeProfileQuery: () => ({
    data: state.queryError
      ? undefined
      : {
          id: state.currentUser.id,
          fullName: state.currentUser.name,
          email: state.currentUser.email,
          role: state.currentUser.role,
          status: "active",
        },
    error: state.queryError,
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
  state.currentUser = {
    id: "user-1",
    name: "Original Name",
    email: "user@example.com",
    role: "student",
  };
  state.queryError = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test.each([
  ["admin", 403],
  ["teacher", 403],
  ["student", 403],
  ["admin", 404],
  ["teacher", 404],
  ["student", 404],
] as const)(
  "ends an editable %s session when /me returns %s",
  async (role, status) => {
    state.currentUser = { ...state.currentUser, role };
    state.queryError = new ApiError("Account unavailable", status);
    render(<ProfileDetailsCard />);

    await waitFor(() => assert.equal(logout.mock.calls.length, 1));
    assert.equal(
      screen.getByRole("button", { name: "Edit Profile" }).hasAttribute("disabled"),
      true,
    );
    assert.match(screen.getByRole("alert").textContent ?? "", /no longer available/i);
  },
);

test.each([403, 404])(
  "ends the session when a profile save returns %s",
  async (status) => {
    saveProfile.mockRejectedValueOnce(new ApiError("Account unavailable", status));
    render(<ProfileDetailsCard />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => assert.equal(logout.mock.calls.length, 1));
    assert.equal(
      screen.getByRole("button", { name: "Edit Profile" }).hasAttribute("disabled"),
      true,
    );
    assert.match(screen.getByRole("alert").textContent ?? "", /no longer available/i);
  },
);
