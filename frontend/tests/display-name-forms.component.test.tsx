/**
 * Location: tests/display-name-forms.component.test.tsx
 * Purpose: Verify every frontend display-name writer shares validation feedback.
 * Why: Registration and admin creation must match the authoritative name contract.
 */

import assert from "node:assert/strict";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, test, vi } from "vitest";

import { ApiError } from "../src/lib/apiClient";

const register = vi.hoisted(() => vi.fn());
const createUser = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@lib/auth", () => ({
  useAuth: () => ({
    currentUser: { id: "", email: "", name: "Guest", role: "public" },
    isAuthenticated: false,
    register,
    loginWithGoogle: vi.fn(),
  }),
}));

vi.mock("@lib/router", () => ({
  useRouter: () => ({ currentPath: "/register", navigate }),
}));

vi.mock("@features/admin/api", () => ({
  useAdminUsersQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateUserMutation: () => ({ mutateAsync: createUser, isPending: false }),
  useApproveTeacherMutation: () => ({ mutateAsync: vi.fn() }),
  useRejectTeacherMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("sonner@2.0.3", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@components/ui/checkbox", () => ({
  Checkbox: ({ onCheckedChange, ...props }: ComponentProps<"input"> & {
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      {...props}
      type="checkbox"
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

vi.mock("@components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <select
      aria-label="I am a..."
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => children,
  SelectValue: () => null,
}));

vi.mock("@components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? children : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const { AuthRegister } = await import("../src/routes/Registration");
const { AdminCreateUserDialog } = await import(
  "../src/features/admin/components/AdminCreateUserDialog"
);

beforeEach(() => {
  register.mockReset();
  createUser.mockReset();
  navigate.mockReset();
});

afterEach(() => cleanup());

const backendNameError = () =>
  new ApiError("Validation failed.", 400, {
    message: "Validation failed.",
    details: {
      fieldErrors: {
        fullName: ["The name is rejected by the current policy."],
      },
      formErrors: [],
    },
  });

test("registration rejects a one-character display name inline", async () => {
  const user = userEvent.setup();
  render(<AuthRegister />);

  await user.type(screen.getByLabelText("Full Name"), "A");
  fireEvent.submit(
    screen.getByRole("button", { name: "Create Account" }).closest("form")!,
  );

  assert.ok(screen.getByText("Name must be between 2 and 100 characters."));
  assert.equal(screen.getByLabelText("Full Name").getAttribute("aria-invalid"), "true");
  assert.equal(register.mock.calls.length, 0);
});

test("registration maps backend fullName errors to the field", async () => {
  register.mockRejectedValueOnce(backendNameError());
  const user = userEvent.setup();
  render(<AuthRegister />);

  await user.type(screen.getByLabelText("Full Name"), "Valid Name");
  await user.type(screen.getByLabelText("Email"), "student@example.com");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "I am a..." }),
    "student",
  );
  await user.type(screen.getByLabelText("Password", { selector: "#password" }), "password1");
  await user.type(screen.getByLabelText("Confirm Password"), "password1");
  await user.click(screen.getByRole("checkbox", { name: /terms and conditions/i }));
  fireEvent.submit(
    screen.getByRole("button", { name: "Create Account" }).closest("form")!,
  );

  assert.ok(await screen.findByText("The name is rejected by the current policy."));
  assert.equal(register.mock.calls.length, 1);
});

test("admin creation rejects a one-character display name inline", async () => {
  const user = userEvent.setup();
  render(<AdminCreateUserDialog open onOpenChange={vi.fn()} />);
  await user.type(screen.getByPlaceholderText("Full name"), "A");
  await user.type(screen.getByPlaceholderText("email@example.com"), "user@example.com");
  await user.click(screen.getByRole("button", { name: "Create User" }));

  assert.ok(screen.getByText("Name must be between 2 and 100 characters."));
  assert.equal(createUser.mock.calls.length, 0);
});

test("admin creation maps backend fullName errors to the field", async () => {
  createUser.mockRejectedValueOnce(backendNameError());
  const user = userEvent.setup();
  render(<AdminCreateUserDialog open onOpenChange={vi.fn()} />);
  await user.type(screen.getByPlaceholderText("Full name"), "Valid Name");
  await user.type(screen.getByPlaceholderText("email@example.com"), "user@example.com");
  await user.click(screen.getByRole("button", { name: "Create User" }));

  assert.ok(await screen.findByText("The name is rejected by the current policy."));
  assert.equal(createUser.mock.calls.length, 1);
});
