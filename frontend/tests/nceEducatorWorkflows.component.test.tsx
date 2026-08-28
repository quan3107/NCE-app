/**
 * Location: tests/nceEducatorWorkflows.component.test.tsx
 * Purpose: Verify rendered NCE path editing and educator attempt summaries.
 * Why: The workflows must be usable through controls, not only available as APIs.
 */

import assert from "node:assert/strict";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, test, vi } from "vitest";
import { NceAttemptSummaries } from "../src/features/nce-content/components/NceAttemptSummaries";
import { NcePathEditor } from "../src/features/nce-content/components/NcePathEditor";
import type { CourseNceLesson } from "../src/features/nce-content/types";

const { assignCourseNceLessons } = vi.hoisted(() => ({
  assignCourseNceLessons: vi.fn(async () => ({
    courseId: "course-1",
    assignedCount: 2,
  })),
}));

vi.mock("../src/features/nce-content/api", () => ({
  assignCourseNceLessons,
  useNceBooksQuery: () => ({ data: { books: [] } }),
  useNceUnitsQuery: () => ({ data: { units: [] }, isLoading: false }),
  useNceLessonsQuery: () => ({ data: { lessons: [] } }),
  useCourseNceAttemptSummariesQuery: () => ({
    data: {
      attempts: [
        {
          id: "attempt-1",
          courseId: "course-1",
          lessonId: "lesson-1",
          exerciseId: "exercise-1",
          studentId: "student-1",
          status: "submitted",
          score: 2,
          maxScore: 3,
          submittedAt: "2026-08-28T08:00:00.000Z",
          createdAt: "2026-08-28T07:00:00.000Z",
          updatedAt: "2026-08-28T08:00:00.000Z",
          student: {
            id: "student-1",
            fullName: "Amelia Student",
            email: "amelia@example.com",
          },
          exercise: {
            id: "exercise-1",
            exerciseType: "gap_fill",
            prompt: "Complete it",
            sortOrder: 1,
            lesson: { id: "lesson-1", title: "Introductions", lessonNumber: 1 },
          },
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    },
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const lesson = (
  id: string,
  title: string,
  sequence: number,
): CourseNceLesson => ({
  id,
  unitId: "unit-1",
  lessonNumber: sequence,
  title,
  lessonText: `${title} text`,
  media: null,
  sortOrder: sequence,
  status: "published",
  publishedAt: "2026-08-28T00:00:00.000Z",
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
  objectives: [],
  exercises: [],
  sequence,
  availableFrom: null,
  dueAt: null,
  canEdit: false,
  canPublish: false,
  isCourseOwned: false,
});

function renderWithQuery(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
}

test("course path controls reorder lessons and persist canonical sequence", async () => {
  const user = userEvent.setup();
  const onSaved = vi.fn(async () => undefined);
  renderWithQuery(
    <NcePathEditor
      courseId="course-1"
      lessons={[
        lesson("lesson-1", "First lesson", 1),
        lesson("lesson-2", "Second lesson", 2),
      ]}
      total={2}
      onSaved={onSaved}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Move First lesson down" }),
  );
  const available = screen.getAllByLabelText("Available from");
  fireEvent.change(available[0], { target: { value: "2026-08-29T09:00" } });
  await user.click(screen.getByRole("button", { name: "Save path" }));

  await waitFor(() =>
    assert.equal(assignCourseNceLessons.mock.calls.length, 1),
  );
  assert.deepEqual(
    assignCourseNceLessons.mock.calls[0]?.[1].lessons.map(
      (item: { lessonId: string; sequence: number }) => ({
        lessonId: item.lessonId,
        sequence: item.sequence,
      }),
    ),
    [
      { lessonId: "lesson-2", sequence: 1 },
      { lessonId: "lesson-1", sequence: 2 },
    ],
  );
  assert.equal(onSaved.mock.calls.length, 1);
});

test("authorized learner activity renders safe summary fields", () => {
  renderWithQuery(<NceAttemptSummaries courseId="course-1" />);
  assert.ok(screen.getByText("Amelia Student"));
  assert.ok(screen.getByText("Lesson 1: Introductions"));
  assert.ok(screen.getByText("2/3"));
  assert.equal(Boolean(screen.queryByText("Complete it")), false);
});
