/**
 * Location: tests/authoringDraftIsolation.component.test.tsx
 * Purpose: Exercise account-owned draft restoration and delayed persistence.
 * Why: Shared browser storage must not transfer unpublished work across accounts.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { setAuthenticatedQueryScope } from "../src/lib/authenticated-query-scope";
import { authoringDraftKey } from "../src/lib/authoring-draft-key";
import { useAutoSave } from "../src/lib/use-auto-save";
import { getInitialStateFromDraft } from "../src/features/assignments/components/teacherIeltsCreate.logic";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  setAuthenticatedQueryScope({ userId: null, generation: 0 });
});

test("restores only the active account draft and ignores unowned legacy drafts", () => {
  const draft = JSON.stringify({
    timestamp: Date.now(),
    data: { selectedType: "reading", assignmentTitle: "Private draft" },
  });
  setAuthenticatedQueryScope({ userId: "teacher-a", generation: 1 });
  localStorage.setItem(authoringDraftKey("ielts_reading"), draft);
  localStorage.setItem("ielts_autosave_ielts_reading", draft);
  expect(getInitialStateFromDraft()?.data.assignmentTitle).toBe(
    "Private draft",
  );
  setAuthenticatedQueryScope({ userId: "teacher-b", generation: 2 });
  expect(getInitialStateFromDraft()).toBeNull();
});

test("a queued save cannot write after the account changes", () => {
  vi.useFakeTimers();
  setAuthenticatedQueryScope({ userId: "teacher-a", generation: 1 });
  const { rerender } = renderHook(
    ({ title }) =>
      useAutoSave({ title }, { key: "ielts_reading", debounceMs: 100 }),
    { initialProps: { title: "" } },
  );
  rerender({ title: "Private pending draft" });
  setAuthenticatedQueryScope({ userId: "teacher-b", generation: 2 });
  act(() => vi.advanceTimersByTime(100));
  expect(localStorage.getItem(authoringDraftKey("ielts_reading"))).toBeNull();
});
