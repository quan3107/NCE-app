/**
 * Location: tests/profileAuthoritativeEdit.component.test.tsx
 * Purpose: Require an authoritative profile baseline before editing.
 * Why: Cached session names must not overwrite newer persisted profile data.
 */
import assert from "node:assert/strict";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

const profileQuery = vi.hoisted(() => ({
  data: undefined as undefined | {
    id: string;
    fullName: string;
    email: string;
    role: "student";
    status: "active";
  },
  error: null as Error | null,
  isPending: true,
  refetch: vi.fn(),
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "user-1",
      name: "Cached Name",
      email: "student@example.com",
      role: "student",
    },
    sessionGeneration: 1,
    commitCurrentProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@features/profile/api", () => ({
  useMeProfileQuery: () => profileQuery,
  useUpdateMeProfileMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const { ProfileDetailsCard } = await import(
  "../src/features/profile/components/ProfileDetailsCard"
);

afterEach(() => {
  cleanup();
  profileQuery.data = undefined;
  profileQuery.error = null;
  profileQuery.isPending = true;
  profileQuery.refetch.mockClear();
});

test("disables editing while the authoritative profile is pending", () => {
  render(<ProfileDetailsCard />);

  assert.equal(
    (screen.getByRole("button", { name: "Edit Profile" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("disables editing when the authoritative profile request fails", () => {
  profileQuery.isPending = false;
  profileQuery.error = new Error("Request failed");
  render(<ProfileDetailsCard />);

  assert.equal(
    (screen.getByRole("button", { name: "Edit Profile" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("a transient profile error remains retryable", () => {
  profileQuery.isPending = false;
  profileQuery.error = new Error("Temporary failure");
  render(<ProfileDetailsCard />);

  assert.match(screen.getByRole("alert").textContent ?? "", /unable to load/i);
  screen.getByRole("button", { name: "Retry" }).click();
  assert.equal(profileQuery.refetch.mock.calls.length, 1);
});
