/**
 * Location: tests/profileLoginProvenance.component.test.tsx
 * Purpose: Verify login identity remains fallback-only until /me is authoritative.
 * Why: Stale login response names must never unlock profile editing or PATCH.
 */
import assert from "node:assert/strict";
import { useState } from "react";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, test, vi } from "vitest";

import { ProfileDetailsCard } from "../src/features/profile/components/ProfileDetailsCard";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";

function LoginThenProfile() {
  const auth = useAuth();
  const [loginStarted, setLoginStarted] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoginStarted(true);
          void auth.login("student@example.com", "password");
        }}
      >
        Sign in test user
      </button>
      <output data-testid="auth-ready">
        {auth.isRestoringSession ? "restoring" : "ready"}
      </output>
      {loginStarted && auth.isAuthenticated ? <ProfileDetailsCard /> : null}
    </>
  );
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

test("stale login profile data cannot unlock editing before delayed /me", async () => {
  let resolveProfile!: (response: Response) => void;
  let patchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh")) {
        return Response.json({ message: "No session" }, { status: 401 });
      }
      if (path.endsWith("/auth/login")) {
        return Response.json({
          accessToken: "student-token",
          user: {
            id: "user-1",
            email: "student@example.com",
            fullName: "Stale Login Name",
            role: "student",
          },
        });
      }
      if (path.endsWith("/me") && (init?.method ?? "GET") === "GET") {
        return new Promise<Response>((resolve) => {
          resolveProfile = resolve;
        });
      }
      if (path.endsWith("/me") && init?.method === "PATCH") {
        patchCalls += 1;
        return Response.json({});
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginThenProfile />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() =>
    assert.equal(screen.getByTestId("auth-ready").textContent, "ready"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Sign in test user" }));
  const edit = await screen.findByRole("button", { name: "Edit Profile" });
  assert.equal((edit as HTMLButtonElement).disabled, true);
  fireEvent.click(edit);
  assert.equal(
    Boolean(screen.queryByRole("button", { name: "Save Changes" })),
    false,
  );
  assert.equal(patchCalls, 0);

  resolveProfile(
    Response.json({
      profile: {
        id: "user-1",
        email: "student@example.com",
        fullName: "Authoritative Name",
        role: "student",
        status: "active",
      },
    }),
  );
  await waitFor(() =>
    assert.equal((edit as HTMLButtonElement).disabled, false),
  );
  assert.equal(patchCalls, 0);
});
