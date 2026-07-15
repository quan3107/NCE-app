/**
 * Location: tests/analytics.component.test.tsx
 * Purpose: Verify rendered analytics course filtering and export behavior.
 * Why: Ensures teachers select accessible courses and exports reuse the visible filter.
 */
import assert from "node:assert/strict";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, test, vi } from "vitest";

import { TeacherAnalyticsPage } from "../src/features/analytics/components/TeacherAnalyticsPage";

const analyticsQuery = vi.hoisted(() => vi.fn());
const exportCsv = vi.hoisted(() => vi.fn(async () => new Blob(["analytics"])));
const courseId = "22222222-2222-4222-8222-222222222222";
const unavailableCourseId = "44444444-4444-4444-8444-444444444444";
const courseQueryState = vi.hoisted(() => ({
  current: {
    data: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Advanced Writing",
      },
      { id: "33333333-3333-4333-8333-333333333333", title: "IELTS Speaking" },
    ],
    isLoading: false,
    error: null as Error | null,
  },
}));

vi.mock("@features/analytics/api", () => ({
  fetchTeacherAnalyticsCsv: exportCsv,
  useTeacherAnalyticsQuery: analyticsQuery,
}));

vi.mock("@features/courses/api", () => ({
  useCoursesQuery: () => courseQueryState.current,
}));

vi.mock("../src/features/analytics/components/AnalyticsCharts", () => ({
  AnalyticsCharts: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  analyticsQuery.mockReset();
  exportCsv.mockClear();
  courseQueryState.current = {
    data: [
      { id: courseId, title: "Advanced Writing" },
      { id: "33333333-3333-4333-8333-333333333333", title: "IELTS Speaking" },
    ],
    isLoading: false,
    error: null,
  };
});

test("selecting an accessible course updates analytics and its CSV export", async () => {
  analyticsQuery.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  });
  const createObjectUrl = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:analytics");
  const revokeObjectUrl = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => {});
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/teacher/analytics"]}>
      <TeacherAnalyticsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  await user.selectOptions(screen.getByLabelText("Course"), courseId);

  await waitFor(() => {
    assert.equal(
      screen.getByTestId("location").textContent,
      `?courseId=${courseId}`,
    );
    assert.ok(
      analyticsQuery.mock.calls.some(
        ([filters]) => filters.courseId === courseId,
      ),
    );
  });

  await user.click(screen.getByRole("button", { name: /export csv/i }));
  await waitFor(() =>
    assert.equal(exportCsv.mock.lastCall?.[0].courseId, courseId),
  );

  click.mockRestore();
  revokeObjectUrl.mockRestore();
  createObjectUrl.mockRestore();
});

test("an invalid course search parameter never reaches analytics requests", () => {
  analyticsQuery.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
  });

  render(
    <MemoryRouter initialEntries={["/teacher/analytics?courseId=partial-id"]}>
      <TeacherAnalyticsPage />
    </MemoryRouter>,
  );

  assert.ok(analyticsQuery.mock.calls.length > 0);
  assert.ok(
    analyticsQuery.mock.calls.every(
      ([filters]) => filters.courseId === undefined,
    ),
  );
  assert.equal(
    (screen.getByLabelText("Course") as HTMLSelectElement).value,
    "",
  );
});

test("an unavailable deep-linked course converges to all accessible courses", async () => {
  analyticsQuery.mockReturnValue({ data: null, isLoading: false, error: null });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:analytics");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const user = userEvent.setup();

  render(
    <MemoryRouter
      initialEntries={[
        `/teacher/analytics?courseId=${unavailableCourseId}`,
      ]}
    >
      <TeacherAnalyticsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.equal(screen.getByTestId("location").textContent, "");
    assert.equal(
      (screen.getByLabelText("Course") as HTMLSelectElement).value,
      "",
    );
    assert.equal(analyticsQuery.mock.lastCall?.[0].courseId, undefined);
  });

  await user.click(screen.getByRole("button", { name: /export csv/i }));
  await waitFor(() =>
    assert.equal(exportCsv.mock.lastCall?.[0].courseId, undefined),
  );
});

test("an accessible deep-linked course remains selected", () => {
  analyticsQuery.mockReturnValue({ data: null, isLoading: false, error: null });

  render(
    <MemoryRouter initialEntries={[`/teacher/analytics?courseId=${courseId}`]}>
      <TeacherAnalyticsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  assert.equal(
    screen.getByTestId("location").textContent,
    `?courseId=${courseId}`,
  );
  assert.equal(
    (screen.getByLabelText("Course") as HTMLSelectElement).value,
    courseId,
  );
  assert.equal(analyticsQuery.mock.lastCall?.[0].courseId, courseId);
});

test("course loading preserves a valid deep-linked filter", () => {
  courseQueryState.current = { data: [], isLoading: true, error: null };
  analyticsQuery.mockReturnValue({ data: null, isLoading: false, error: null });

  render(
    <MemoryRouter initialEntries={[`/teacher/analytics?courseId=${courseId}`]}>
      <TeacherAnalyticsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  assert.equal(
    screen.getByTestId("location").textContent,
    `?courseId=${courseId}`,
  );
  assert.equal(analyticsQuery.mock.lastCall?.[0].courseId, courseId);
});

test("a course-options error clears rather than traps a hidden filter", async () => {
  courseQueryState.current = {
    data: [],
    isLoading: false,
    error: new Error("Courses unavailable"),
  };
  analyticsQuery.mockReturnValue({ data: null, isLoading: false, error: null });

  render(
    <MemoryRouter
      initialEntries={[
        `/teacher/analytics?courseId=${unavailableCourseId}`,
      ]}
    >
      <TeacherAnalyticsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  await waitFor(() => {
    assert.equal(screen.getByTestId("location").textContent, "");
    assert.equal(analyticsQuery.mock.lastCall?.[0].courseId, undefined);
    assert.equal(
      (screen.getByLabelText("Course") as HTMLSelectElement).disabled,
      false,
    );
  });
});
