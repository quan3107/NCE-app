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
const refreshCurrentProfile = vi.hoisted(() => vi.fn());

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
    refreshCurrentProfile,
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
  refreshCurrentProfile.mockReset();
  refreshCurrentProfile.mockImplementation(async () =>
    saveProfile.mock.results.at(-1)?.value,
  );
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

test("shows inline length errors without sending invalid profile data", () => {
  editAndSave(" ");

  assert.ok(screen.getByText("Name must be between 2 and 100 characters."));
  assert.equal(saveProfile.mock.calls.length, 0);
});

test("counts astral profile names by Unicode code point", async () => {
  const emoji = "\u{1F600}";
  saveProfile.mockImplementation(async ({ fullName }: { fullName: string }) => ({
    id: "profile-validation-user",
    fullName,
    email: "profile@example.com",
    role: "student",
    status: "active",
  }));

  for (const invalidName of [emoji, emoji.repeat(101)]) {
    cleanup();
    editAndSave(invalidName);
  }
  assert.equal(saveProfile.mock.calls.length, 0);

  for (const validName of [emoji.repeat(2), emoji.repeat(100)]) {
    cleanup();
    editAndSave(validName);
    await waitFor(() => {
      assert.equal(saveProfile.mock.calls.at(-1)?.[0]?.fullName, validName);
    });
  }
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
