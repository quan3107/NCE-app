/**
 * Location: tests/oauthLeaseRecovery.component.test.tsx
 * Purpose: Verify OAuth callback terminal errors release browser coordination.
 * Why: Failed or cancelled Google redirects must not lock later auth operations.
 */
import assert from "node:assert/strict";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";

const authState = vi.hoisted(() => ({
  cancelGoogleLogin: vi.fn(),
  completeGoogleLogin: vi.fn(),
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    cancelGoogleLogin: authState.cancelGoogleLogin,
    completeGoogleLogin: authState.completeGoogleLogin,
    currentUser: {
      id: "",
      email: "",
      name: "Guest",
      role: "public",
    },
  }),
}));

vi.mock("@lib/router", () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

const { OAuthRoute } = await import("../src/routes/OAuth");

beforeEach(() => {
  authState.cancelGoogleLogin.mockReset();
  authState.completeGoogleLogin.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

test("backend OAuth error redirect releases the owned lease", async () => {
  window.history.replaceState(
    {},
    "",
    "/auth/oauth?googleAuth=error&googleAuthMessage=cancelled",
  );

  render(<OAuthRoute />);

  await waitFor(() =>
    assert.equal(authState.cancelGoogleLogin.mock.calls.length, 1),
  );
  assert.equal(authState.completeGoogleLogin.mock.calls.length, 0);
});

test("OAuth completion failure releases the owned lease", async () => {
  authState.completeGoogleLogin.mockRejectedValueOnce(
    new Error("callback failed"),
  );
  window.history.replaceState({}, "", "/auth/oauth");

  render(<OAuthRoute />);

  await waitFor(() =>
    assert.equal(authState.cancelGoogleLogin.mock.calls.length, 1),
  );
});
