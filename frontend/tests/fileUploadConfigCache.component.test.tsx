/**
 * Location: tests/fileUploadConfigCache.component.test.tsx
 * Purpose: Verify upload-policy caching follows the authenticated session identity.
 * Why: Same-role and cross-role account switches must not reuse or restore stale limits.
 */
import assert from "node:assert/strict";
import type { PropsWithChildren } from "react";

import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

const authState = vi.hoisted(() => ({
  role: "student" as "student" | "teacher",
  generation: 1,
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: { role: authState.role },
    sessionGeneration: authState.generation,
  }),
}));

const { useFileUploadConfig } = await import(
  "../src/features/files/configApi"
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});

test("account switch aborts the old policy and fetches the new role policy", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let studentSignal: AbortSignal | undefined;
  let resolveStudentLimit!: (response: Response) => void;
  let requestNumber = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestNumber += 1;
      if (requestNumber <= 2) {
        studentSignal = init?.signal ?? undefined;
        if (requestNumber === 1) {
          return new Promise<Response>((resolve) => {
            resolveStudentLimit = resolve;
          });
        }
        return Promise.resolve(
          Response.json({
            allowed_types: [],
            accept: "",
            type_label: "Student files",
          }),
        );
      }
      if (requestNumber === 3) {
        return Promise.resolve(
          Response.json({
            limits: {
              max_file_size: 52_428_800,
              max_total_size: 104_857_600,
              max_files_per_upload: 5,
            },
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          allowed_types: [],
          accept: "",
          type_label: "Teacher files",
        }),
      );
    }),
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useFileUploadConfig(), { wrapper });
  await waitFor(() => assert.equal(typeof resolveStudentLimit, "function"));

  authState.role = "teacher";
  authState.generation = 2;
  view.rerender();

  await waitFor(() =>
    assert.equal(view.result.current.data?.limits.maxFileSize, 52_428_800),
  );
  assert.equal(studentSignal?.aborted, true);

  resolveStudentLimit(
    Response.json({
      limits: {
        max_file_size: 1_048_576,
        max_total_size: 2_097_152,
        max_files_per_upload: 1,
      },
    }),
  );
  await Promise.resolve();
  assert.equal(view.result.current.data?.limits.maxFileSize, 52_428_800);
  assert.equal(requestNumber, 4);
});

test("independent mounted clients revalidate persisted upload limits", async () => {
  let maxFileSize = 1_048_576;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/config/file-upload-limits")) {
        return Response.json({
          limits: {
            max_file_size: maxFileSize,
            max_total_size: maxFileSize * 2,
            max_files_per_upload: 2,
          },
        });
      }
      return Response.json({
        allowed_types: [],
        accept: "",
        type_label: "Files",
      });
    }),
  );
  const firstClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const secondClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const first = renderHook(() => useFileUploadConfig(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={firstClient}>{children}</QueryClientProvider>
    ),
  });
  const second = renderHook(() => useFileUploadConfig(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={secondClient}>{children}</QueryClientProvider>
    ),
  });
  await waitFor(() => {
    assert.equal(first.result.current.data?.limits.maxFileSize, 1_048_576);
    assert.equal(second.result.current.data?.limits.maxFileSize, 1_048_576);
  });
  assert.equal(
    firstClient.getQueryCache().getAll()[0]?.options.refetchInterval,
    60_000,
  );
  assert.equal(
    secondClient.getQueryCache().getAll()[0]?.options.refetchInterval,
    60_000,
  );

  maxFileSize = 5_242_880;
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

  await waitFor(() => {
    assert.equal(first.result.current.data?.limits.maxFileSize, 5_242_880);
    assert.equal(second.result.current.data?.limits.maxFileSize, 5_242_880);
  });
});
