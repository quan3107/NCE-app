/**
 * Location: tests/profile-validation.component.test.tsx
 * Purpose: Verify complete profile-name validation and server field feedback.
 * Why: Unsafe names and actionable backend errors must remain at the name field.
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

import { ApiError } from "../src/lib/apiClient";

const saveProfile = vi.hoisted(() => vi.fn());
const commitCurrentProfile = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "profile-validation-user",
      name: "Original Name",
      email: "profile@example.com",
      role: "student",
    },
    sessionGeneration: 1,
    commitCurrentProfile,
  }),
}));

vi.mock("@features/profile/api", () => ({
  useMeProfileQuery: () => ({
    data: {
      id: "profile-validation-user",
      fullName: "Original Name",
      email: "profile@example.com",
      role: "student",
      status: "active",
    },
  }),
  useUpdateMeProfileMutation: () => ({
    mutateAsync: saveProfile,
    isPending: false,
  }),
}));

const { ProfileDetailsCard } =
  await import("../src/features/profile/components/ProfileDetailsCard");

beforeEach(() => {
  saveProfile.mockReset();
  commitCurrentProfile.mockClear();
});

afterEach(() => {
  cleanup();
});

function editAndSave(fullName: string): void {
  render(<ProfileDetailsCard />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: fullName },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
}

test("rejects backend-forbidden display controls before sending", () => {
  editAndSave("Ada\u200ELovelace");

  assert.ok(
    screen.getByText(
      "Full name must not contain non-printing or bidirectional controls",
    ),
  );
  assert.equal(saveProfile.mock.calls.length, 0);
});

test("surfaces backend fullName field errors at the name input", async () => {
  saveProfile.mockRejectedValueOnce(
    new ApiError("Validation failed.", 400, {
      message: "Validation failed.",
      details: {
        formErrors: [],
        fieldErrors: {
          fullName: ["The saved name conflicts with the current policy."],
        },
      },
    }),
  );

  editAndSave("Valid Profile Name");

  await waitFor(() => {
    assert.ok(
      screen.getByText("The saved name conflicts with the current policy."),
    );
  });
  assert.equal(
    Boolean(
      screen.queryByText("Unable to save your profile. Please try again."),
    ),
    false,
  );
  assert.equal(
    screen.getByLabelText("Name").getAttribute("aria-invalid"),
    "true",
  );
});
