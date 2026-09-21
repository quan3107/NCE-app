/**
 * Location: tests/assignmentKeyboard.component.test.tsx
 * Purpose: Verify keyboard activation and valid Reading editor control semantics.
 * Why: Skill selection and passage editing must be reachable without a pointer.
 */
import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { IeltsTypeSelection } from "../src/features/assignments/components/ielts/authoring/IeltsTypeSelection";
import { IeltsReadingContentEditor } from "../src/features/assignments/components/ielts/IeltsReadingContentEditor";
import type { IeltsReadingConfig } from "../src/lib/ielts";

vi.mock("@features/ielts-config/typeMetadata.api", () => ({
  useIeltsTypeMetadata: () => ({
    data: [
      {
        id: "reading",
        title: "Reading",
        description: "Passages",
        icon: "book",
        theme: "blue",
      },
    ],
  }),
}));
vi.mock("@features/ielts-config/api", () => ({
  useEnabledReadingQuestionTypes: () => ({ data: [] }),
  useEnabledCompletionFormats: () => ({ data: [] }),
}));
afterEach(cleanup);

test("skill selection is a named keyboard button with visible focus styling", async () => {
  const onSelect = vi.fn();
  render(<IeltsTypeSelection onSelect={onSelect} />);
  const user = userEvent.setup();
  await user.tab();
  const card = screen.getByRole("button", { name: "Reading" });
  expect(document.activeElement).toBe(card);
  expect(card.className).toContain("focus-visible:ring-2");
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith("reading");
});

test("passage deletion is outside tabs and the remaining editor stays usable", async () => {
  function Editor() {
    const [value, setValue] = useState<IeltsReadingConfig>({
      version: 1,
      sections: [
        { id: "a", title: "First", passage: "One", questions: [] },
        { id: "b", title: "Second", passage: "Two", questions: [] },
      ],
    } as IeltsReadingConfig);
    return <IeltsReadingContentEditor value={value} onChange={setValue} />;
  }
  const { container } = render(<Editor />);
  expect(container.querySelector("button button")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Passage title" })).toBeTruthy();
  const user = userEvent.setup();
  const remove = screen.getByRole("button", { name: "Delete passage 1" });
  remove.focus();
  await user.keyboard("{Enter}");
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(
    (
      screen.getByRole("textbox", {
        name: "Passage text",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Two");
});
