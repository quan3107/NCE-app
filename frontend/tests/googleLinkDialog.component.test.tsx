/**
 * Location: tests/googleLinkDialog.component.test.tsx
 * Purpose: Exercise consent, cancellation, errors, and stale UI effects in isolation.
 * Why: Component mocks supplement, never replace, real OAuth acceptance.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GoogleLinkDialog } from "../src/routes/GoogleLinkDialog";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  navigate: vi.fn(),
  login: vi.fn(),
}));
vi.mock("../src/lib/apiClient", () => ({
  apiClient: mocks.api,
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
vi.mock("../src/lib/router", () => ({
  useRouter: () => ({ navigate: mocks.navigate }),
}));
vi.mock("../src/store/authStore", () => ({
  useAuthStore: () => ({ loginWithGoogle: mocks.login }),
}));
const challenge = {
  challengeId: "test-challenge",
  email: "local@example.invalid",
  expiresAt: "2026-09-22T00:05:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.mockResolvedValueOnce(challenge);
});
afterEach(cleanup);
test("an expired proof disables confirmation and keeps a working return to login", async () => {
  const { ApiError } = await import("../src/lib/apiClient");
  mocks.api.mockRejectedValueOnce(
    new ApiError("Account linking is invalid or expired.", 400),
  );
  await show();
  fireEvent.change(screen.getByLabelText("Existing account password"), {
    target: { value: "existing-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Link accounts" }));
  await screen.findByRole("alert");
  expect(
    (screen.getByRole("button", { name: "Link accounts" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.navigate).toHaveBeenCalledWith("/login");
  expect(mocks.api).toHaveBeenCalledTimes(2);
});
async function show() {
  const view = render(<GoogleLinkDialog />);
  await screen.findByText(/An account already exists/);
  return view;
}
test("requires a password and submits explicit consent only on confirmation", async () => {
  await show();
  expect(
    (screen.getByRole("button", { name: "Link accounts" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Existing account password"), {
    target: { value: "existing-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Link accounts" }));
  await screen.findByText("Google account linked");
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/auth/google/link",
    expect.objectContaining({
      body: {
        challengeId: challenge.challengeId,
        consent: true,
        password: "existing-secret",
      },
    }),
  );
  expect(mocks.login).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});
test("cancels on the server without sending a password or consent", async () => {
  await show();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/login"));
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/auth/google/link/cancel",
    expect.objectContaining({ body: { challengeId: challenge.challengeId } }),
  );
});
test("clears an incorrect password, shows the server error, and allows retry", async () => {
  const { ApiError } = await import("../src/lib/apiClient");
  mocks.api.mockRejectedValueOnce(
    new ApiError("Incorrect password. Accounts have not been linked.", 401),
  );
  await show();
  fireEvent.change(screen.getByLabelText("Existing account password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Link accounts" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Incorrect password",
  );
  expect(
    (screen.getByLabelText("Existing account password") as HTMLInputElement)
      .value,
  ).toBe("");
  expect(screen.queryByText("Google account linked")).toBeNull();
});
test("a cancellation completing after navigation cannot redirect the destination", async () => {
  let resolve!: () => void;
  mocks.api.mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const view = await show();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  view.unmount();
  await act(async () => resolve());
  expect(mocks.navigate).not.toHaveBeenCalled();
});
