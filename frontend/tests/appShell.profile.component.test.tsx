/**
 * Location: tests/appShell.profile.component.test.tsx
 * Purpose: Verify live admin navigation exposes the profile dropdown action.
 * Why: The route is only discoverable when the backend navigation item is consumed.
 */
import assert from "node:assert/strict";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@store/authStore", () => ({
  useAuthStore: () => ({
    currentUser: {
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
    logout: vi.fn(),
  }),
}));

vi.mock("@lib/router", () => ({
  useRouter: () => ({
    currentPath: "/admin/dashboard",
    navigate,
  }),
}));

vi.mock("@features/navigation", () => ({
  useNavigationContext: () => ({
    items: [
      {
        id: "admin-profile",
        label: "Profile",
        path: "/admin/profile",
        iconName: "user",
        requiredPermission: "profile:view",
        orderIndex: 7,
        badgeSource: null,
        children: [],
        isActive: true,
        featureFlag: null,
      },
    ],
    badgeCounts: {},
    source: "live",
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@features/navigation/components/NavigationItem", () => ({
  NavigationItem: () => null,
}));

const { AppShellAuthenticated } = await import(
  "../src/components/layout/AppShellAuthenticated"
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("admin dropdown navigates to the live profile item", async () => {
  const user = userEvent.setup();
  render(
    <AppShellAuthenticated>
      <main>Admin content</main>
    </AppShellAuthenticated>,
  );

  await user.click(screen.getByRole("button", { name: /Admin User/i }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Profile" }));

  assert.deepEqual(navigate.mock.calls[0], ["/admin/profile"]);
});
