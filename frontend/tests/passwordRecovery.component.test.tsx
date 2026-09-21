/**
 * Location: tests/passwordRecovery.component.test.tsx
 * Purpose: Verify recovery form validation, focus, retries, and accessible feedback.
 * Why: Component checks supplement the separate real API/database acceptance run.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { PasswordRecoveryRoute } from "../src/routes/PasswordRecovery";
import { ApiError, apiClient } from "../src/lib/apiClient";

vi.mock("../src/lib/apiClient", async (original) => ({
  ...(await original<typeof import("../src/lib/apiClient")>()),
  apiClient: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});
const token = "a".repeat(64);
const open = (path = "/forgot-password") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PasswordRecoveryRoute />
    </MemoryRouter>,
  );

test("requests recovery without attaching browser credentials and focuses generic feedback", async () => {
  vi.mocked(apiClient).mockResolvedValue({
    message: "If an eligible account exists, check your inbox.",
  });
  open();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "user@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "If an eligible account",
    ),
  );
  expect(document.activeElement).toBe(screen.getByRole("status"));
  expect(apiClient).toHaveBeenCalledWith(
    "/auth/forgot-password",
    expect.objectContaining({ auth: "none", credentials: "omit" }),
  );
});

test("rejects mismatched passwords without consuming the token", async () => {
  open(`/reset-password#token=${token}`);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "New-password-2026" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "Other-password-2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Passwords do not match.",
    ),
  );
  expect(apiClient).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("alert"));
});

test("shows expired/reused error and lets the user request another link", async () => {
  vi.mocked(apiClient).mockRejectedValue(
    new ApiError(
      "This password reset link is invalid or expired. Request a new link.",
      400,
    ),
  );
  open(`/reset-password#token=${token}`);
  for (const name of ["New password", "Confirm new password"])
    fireEvent.change(screen.getByLabelText(name), {
      target: { value: "New-password-2026" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "invalid or expired",
    ),
  );
  expect(
    screen
      .getByRole("link", { name: "Request a new reset link" })
      .getAttribute("href"),
  ).toBe("/forgot-password");
});

test("provides a retry after transport failure and clears password fields after success", async () => {
  vi.mocked(apiClient)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      message: "Password reset. Sign in with your new password.",
    });
  open(`/reset-password#token=${token}`);
  for (const name of ["New password", "Confirm new password"])
    fireEvent.change(screen.getByLabelText(name), {
      target: { value: "New-password-2026" },
    });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to connect",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("Password reset"),
  );
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href"),
  ).toBe("/login");
});

test("a missing token never exposes an actionable reset form", () => {
  open("/reset-password");
  expect(screen.getByRole("alert").textContent).toContain("invalid or missing");
  expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
});

test.each(["success", "failure"])(
  "late reset %s preserves the destination URL and form after navigation",
  async (outcome) => {
    let resolve!: (value: { message: string }) => void;
    let reject!: (reason: Error) => void;
    vi.mocked(apiClient).mockReturnValue(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
    );
    window.history.replaceState(null, "", `/reset-password#token=${token}`);
    render(
      <BrowserRouter>
        <Routes>
          <Route
            path="reset-password"
            element={<PasswordRecoveryRoute key="reset" />}
          />
          <Route
            path="forgot-password"
            element={<PasswordRecoveryRoute key="request" />}
          />
        </Routes>
      </BrowserRouter>,
    );
    for (const name of ["New password", "Confirm new password"])
      fireEvent.change(screen.getByLabelText(name), {
        target: { value: "New-password-2026" },
      });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    fireEvent.click(
      screen.getByRole("link", { name: "Request a new reset link" }),
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "draft@example.invalid" },
    });
    await act(async () => {
      if (outcome === "success") resolve({ message: "Password reset." });
      else reject(new ApiError("Expired reset", 400));
    });
    expect(window.location.pathname).toBe("/forgot-password");
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).value,
    ).toBe("draft@example.invalid");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(
      (
        screen.getByRole("button", {
          name: "Send reset link",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  },
);
