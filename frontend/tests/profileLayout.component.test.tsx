/**
 * Location: tests/profileLayout.component.test.tsx
 * Purpose: Verify the profile header uses the card's side-by-side action slot.
 * Why: Grid headers ignore flex-row utilities unless the action is placed explicitly.
 */
import assert from "node:assert/strict";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "user-1",
      name: "Profile User",
      email: "profile@example.com",
      role: "student",
    },
    sessionGeneration: 1,
    commitCurrentProfile: vi.fn(),
  }),
}));

vi.mock("@features/profile/api", () => ({
  useMeProfileQuery: () => ({ data: undefined }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import { ProfileDetailsCard } from "../src/features/profile/components/ProfileDetailsCard";

afterEach(cleanup);

test("places the edit control in the card action slot", () => {
  const { container } = render(<ProfileDetailsCard />);

  const action = container.querySelector('[data-slot="card-action"]');
  assert.ok(action);
  assert.ok(action.contains(screen.getByRole("button", { name: "Edit Profile" })));
});
