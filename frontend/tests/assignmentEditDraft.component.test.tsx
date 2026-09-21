/**
 * Location: tests/assignmentEditDraft.component.test.tsx
 * Purpose: Keep local edits intact when a prior mutation refreshes the cache.
 * Why: Returning to an assignment must give the new draft its own lifetime.
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TeacherAssignmentEditPage } from "../src/features/assignments/components/TeacherAssignmentEditPage";
vi.mock("../src/features/assignments/components/ielts/IeltsTypeCards", () => ({
  IeltsTypeCards: () => null,
}));

const state = vi.hoisted(() => ({
  assignment: {
    id: "a",
    courseId: "course",
    title: "Assignment A",
    type: "text",
    description: "Original",
  },
}));
vi.mock("@features/assignments/api", () => ({
  useAssignmentResources: () => ({
    assignments: [state.assignment],
    courses: [],
    isLoading: false,
  }),
  useUpdateAssignmentMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@lib/router", () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
afterEach(cleanup);

test("a cache refresh preserves the current local draft and a new resource initializes independently", () => {
  const view = render(<TeacherAssignmentEditPage key="a" assignmentId="a" />);
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
    target: { value: "Newer local draft" },
  });
  state.assignment = {
    ...state.assignment,
    description: "Earlier save completed",
  };
  view.rerender(<TeacherAssignmentEditPage key="a" assignmentId="a" />);
  expect(
    (
      screen.getByRole("textbox", {
        name: "Description",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Newer local draft");
  state.assignment = {
    ...state.assignment,
    id: "b",
    title: "Assignment B",
    description: "B original",
  };
  view.rerender(<TeacherAssignmentEditPage key="b" assignmentId="b" />);
  expect(
    (
      screen.getByRole("textbox", {
        name: "Description",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("B original");
});
