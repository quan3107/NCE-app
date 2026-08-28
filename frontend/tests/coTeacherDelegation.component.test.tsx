/**
 * Location: tests/coTeacherDelegation.component.test.tsx
 * Purpose: Verify course-owner co-teacher selection and revocation controls.
 * Why: COURSE-06 failed when the selected teacher could not persist through the UI.
 */

import assert from "node:assert/strict";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, test, vi } from "vitest";
import { CoTeachersCard } from "../src/features/courses/management/components/tabs/CoTeachersCard";

const { addCourseTeacher, removeCourseTeacher } = vi.hoisted(() => ({
  addCourseTeacher: vi.fn(async () => undefined),
  removeCourseTeacher: vi.fn(async () => undefined),
}));

vi.mock("../src/features/courses/management/api", () => ({
  addCourseTeacher,
  removeCourseTeacher,
  useCourseTeachersQuery: () => ({
    data: {
      courseId: "course-1",
      teachers: [
        {
          id: "teacher-existing",
          fullName: "Existing Teacher",
          email: "existing@example.com",
          status: "active",
          enrolledAt: "2026-08-28T00:00:00.000Z",
        },
      ],
    },
    isLoading: false,
  }),
  useCourseTeacherCandidatesQuery: () => ({
    data: {
      courseId: "course-1",
      teachers: [
        {
          id: "teacher-sarah",
          fullName: "Sarah Teacher",
          email: "sarah@example.com",
          status: "active",
        },
      ],
    },
    isLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("owner selection survives and submits the chosen active teacher", async () => {
  const user = userEvent.setup();
  render(<CoTeachersCard courseId="course-1" canManage />);

  await user.click(screen.getByLabelText("Active teacher"));
  await user.click(
    screen.getByRole("option", { name: "Sarah Teacher (sarah@example.com)" }),
  );
  assert.ok(screen.getByText("Sarah Teacher (sarah@example.com)"));
  await user.click(screen.getByRole("button", { name: "Add co-teacher" }));

  await waitFor(() =>
    assert.deepEqual(addCourseTeacher.mock.calls[0], [
      "course-1",
      "sarah@example.com",
    ]),
  );
  await user.click(
    screen.getByRole("button", { name: "Remove Existing Teacher" }),
  );
  await waitFor(() =>
    assert.deepEqual(removeCourseTeacher.mock.calls[0], [
      "course-1",
      "teacher-existing",
    ]),
  );
});

test("co-teachers see the roster without peer-management controls", () => {
  render(<CoTeachersCard courseId="course-1" canManage={false} />);
  assert.ok(screen.getByText("Existing Teacher"));
  assert.equal(Boolean(screen.queryByLabelText("Active teacher")), false);
  assert.equal(
    Boolean(screen.queryByRole("button", { name: "Remove Existing Teacher" })),
    false,
  );
});
