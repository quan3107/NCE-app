/**
 * Location: tests/mutationLifetime.component.test.tsx
 * Purpose: Exercise deferred callbacks across navigation, unmount and identity changes.
 * Why: Successful network completion alone must never authorize a later UI update.
 */
import React from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useMutationLifetime } from "../src/lib/useMutationLifetime";
import { setAuthenticatedQueryScope } from "../src/lib/authenticated-query-scope";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  setAuthenticatedQueryScope({ generation: 0, userId: null });
});

test("completion is accepted only while its initiating component is mounted", () => {
  const { result, unmount } = renderHook(useMutationLifetime, {
    wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
  });
  const isCurrent = result.current();
  expect(isCurrent()).toBe(true);
  unmount();
  expect(isCurrent()).toBe(false);
});

test("changing resource route rejects a late response even before unmount", () => {
  window.history.replaceState(null, "", "/teacher/assignments/first");
  const { result } = renderHook(useMutationLifetime);
  const isCurrent = result.current();
  window.history.replaceState(null, "", "/teacher/assignments/second");
  expect(isCurrent()).toBe(false);
});

test("another generation of the same account rejects the old completion", () => {
  setAuthenticatedQueryScope({ generation: 1, userId: "teacher" });
  const { result } = renderHook(useMutationLifetime);
  const isCurrent = result.current();
  setAuthenticatedQueryScope({ generation: 2, userId: "teacher" });
  expect(isCurrent()).toBe(false);
  expect(result.current()()).toBe(true);
});
