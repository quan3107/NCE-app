/**
 * Location: tests/protectedRoutePeerRevalidation.component.test.tsx
 * Purpose: Keep protected routes mounted behind loading during peer revalidation.
 * Why: Clearing stale authority must not expose a redirect before refresh settles.
 */

import assert from "node:assert/strict";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, test, vi } from "vitest";

import { AuthProvider } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";
import { RequireAuth } from "../src/routes/AppRoutes";

const authResponse = {
  accessToken: "student-token",
  user: {
    id: "student-1",
    email: "student@example.com",
    fullName: "Student One",
    role: "student" as const,
  },
};

afterEach(() => {
  cleanup();
  queryClient.clear();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

test("peer revalidation keeps a protected route loading until refresh settles", async () => {
  let refreshCalls = 0;
  let resolvePeerRefresh!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        if (refreshCalls === 1) return Promise.resolve(Response.json(authResponse));
        return new Promise<Response>((resolve) => {
          resolvePeerRefresh = resolve;
        });
      }
      if (path.endsWith("/me")) {
        return Promise.resolve(
          Response.json({
            profile: {
              ...authResponse.user,
              status: "active",
              profileRevision: 0,
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );

  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/student/dashboard"]}>
        <Routes>
          <Route
            path="/student/dashboard"
            element={
              <RequireAuth>
                <div>Protected dashboard</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
  await screen.findByText("Protected dashboard");

  const invalidation = {
    schemaVersion: 1,
    epoch: Date.now() + 1,
    reason: "account-change",
    nonce: "peer-account-change:1",
  };
  act(() => {
    const serialized = JSON.stringify(invalidation);
    window.localStorage.setItem("nce:auth-invalidation", serialized);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "nce:auth-invalidation",
        newValue: serialized,
      }),
    );
  });

  await waitFor(() => assert.equal(refreshCalls, 2));
  assert.ok(screen.getByRole("status"));
  assert.equal(Boolean(screen.queryByText("Login page")), false);

  await act(async () => {
    resolvePeerRefresh(Response.json(authResponse));
  });
  await screen.findByText("Protected dashboard");
  assert.equal(Boolean(screen.queryByText("Login page")), false);
});
