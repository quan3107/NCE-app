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
import { afterEach, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const saveSettings = vi.hoisted(() => vi.fn());
const settingsData = vi.hoisted(() => ({
  limits: [
    { role: "student" as const, maxFileSizeMb: 25 },
    { role: "teacher" as const, maxFileSizeMb: 25 },
    { role: "admin" as const, maxFileSizeMb: 25 },
  ],
}));

vi.mock("@features/admin/settingsApi", () => ({
  useAdminUploadLimitsQuery: () => ({
    data: settingsData,
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
    "Student max file size (MB)",
  );

  fireEvent.change(studentLimit, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  assert.ok(screen.getByText("Enter a whole number from 1 to 100 MB."));
  assert.equal(saveSettings.mock.calls.length, 0);
});

test("submits every controlled role limit to runtime persistence", async () => {
  saveSettings.mockResolvedValueOnce({
    limits: [
      { role: "student", maxFileSizeMb: 12 },
      { role: "teacher", maxFileSizeMb: 25 },
      { role: "admin", maxFileSizeMb: 25 },
    ],
  });
  render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  );
  const studentLimit = await screen.findByLabelText(
    "Student max file size (MB)",
  );

  fireEvent.change(studentLimit, { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

  await waitFor(() => {
    assert.deepEqual(saveSettings.mock.calls[0]?.[0], {
      limits: [
        { role: "student", maxFileSizeMb: 12 },
        { role: "teacher", maxFileSizeMb: 25 },
        { role: "admin", maxFileSizeMb: 25 },
      ],
    });
  });
});
