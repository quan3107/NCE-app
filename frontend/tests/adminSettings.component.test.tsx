/**
 * Location: tests/adminSettings.component.test.tsx
 * Purpose: Verify controlled, validated admin upload-limit settings.
 * Why: The settings page must expose only values persisted into runtime enforcement.
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
import { MemoryRouter } from "react-router-dom";

import { ApiError } from "../src/lib/apiClient";

const saveSettings = vi.hoisted(() => vi.fn());
const settingsState = vi.hoisted(() => ({
  data: {
    limits: [
      { role: "student" as const, maxFileSizeMib: 25 },
      { role: "teacher" as const, maxFileSizeMib: 25 },
      { role: "admin" as const, maxFileSizeMib: 25 },
    ],
  },
}));

vi.mock("@features/admin/settingsApi", () => ({
  useAdminUploadLimitsQuery: () => ({
    data: settingsState.data,
    isLoading: false,
    error: null,
  }),
  useUpdateAdminUploadLimitsMutation: () => ({
    mutateAsync: saveSettings,
    isPending: false,
    error: null,
  }),
}));

const { AdminSettingsPage } = await import(
  "../src/features/admin/components/AdminSettingsPage"
);

beforeEach(() => {
  settingsState.data = {
    limits: [
      { role: "student", maxFileSizeMib: 25 },
      { role: "teacher", maxFileSizeMib: 25 },
      { role: "admin", maxFileSizeMib: 25 },
    ],
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("blocks out-of-range upload limits with inline feedback", async () => {
  render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );
  const studentLimit = await screen.findByLabelText(
    "Student max file size (MiB)",
  );

  fireEvent.change(studentLimit, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  assert.ok(screen.getByText("Enter a whole number from 1 to 100 MiB."));
  assert.equal(saveSettings.mock.calls.length, 0);
});

test("submits only dirty roles with their expected values", async () => {
  saveSettings.mockResolvedValueOnce({
    limits: [
      { role: "student", maxFileSizeMib: 12 },
      { role: "teacher", maxFileSizeMib: 25 },
      { role: "admin", maxFileSizeMib: 25 },
    ],
  });
  render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );
  const studentLimit = await screen.findByLabelText(
    "Student max file size (MiB)",
  );

  fireEvent.change(studentLimit, { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  await waitFor(() => {
    assert.deepEqual(saveSettings.mock.calls[0]?.[0], {
      updates: {
        student: {
          expectedMaxFileSizeMib: 25,
          maxFileSizeMib: 12,
        },
      },
    });
  });
});

test("shows a reload message when another admin changed the same role", async () => {
  saveSettings.mockRejectedValueOnce(
    new ApiError("File upload limits changed; reload before saving.", 409),
  );
  render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );
  fireEvent.change(
    await screen.findByLabelText("Teacher max file size (MiB)"),
    { target: { value: "30" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  await waitFor(() => {
    assert.ok(
      screen.getByText(
        "Settings changed in another session. Reload before saving again.",
      ),
    );
  });
});

test("preserves dirty roles and their baseline during background refresh", async () => {
  saveSettings.mockResolvedValueOnce({
    limits: [
      { role: "student", maxFileSizeMib: 12 },
      { role: "teacher", maxFileSizeMib: 40 },
      { role: "admin", maxFileSizeMib: 25 },
    ],
  });
  const view = render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );
  const studentLimit = await screen.findByLabelText(
    "Student max file size (MiB)",
  );
  fireEvent.change(studentLimit, { target: { value: "12" } });

  settingsState.data = {
    limits: [
      { role: "student", maxFileSizeMib: 30 },
      { role: "teacher", maxFileSizeMib: 40 },
      { role: "admin", maxFileSizeMib: 25 },
    ],
  };
  view.rerender(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );

  assert.equal((studentLimit as HTMLInputElement).value, "12");
  assert.equal(
    (screen.getByLabelText("Teacher max file size (MiB)") as HTMLInputElement)
      .value,
    "40",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  await waitFor(() => {
    assert.deepEqual(saveSettings.mock.calls[0]?.[0], {
      updates: {
        student: {
          expectedMaxFileSizeMib: 25,
          maxFileSizeMib: 12,
        },
      },
    });
  });
});
