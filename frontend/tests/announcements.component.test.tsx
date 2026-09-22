/** Announcement component regressions supplement the real Browser/API acceptance flow. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CourseAnnouncements } from "../src/features/announcements/CourseAnnouncements";
import * as api from "../src/features/announcements/api";

const identity = vi.hoisted(() => ({ role: "teacher" }));
vi.mock("../src/store/authStore", () => ({
  useAuthStore: () => ({ currentUser: { id: "actor", role: identity.role } }),
}));
vi.mock("../src/features/announcements/api", () => ({
  fetchAnnouncements: vi.fn(),
  createAnnouncement: vi.fn(),
  editAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}));
beforeEach(() => {
  identity.role = "teacher";
  vi.mocked(api.fetchAnnouncements).mockResolvedValue({
    data: [],
    nextOffset: null,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function open() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <CourseAnnouncements courseId="course" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function draft() {
  fireEvent.click(
    await screen.findByRole("button", { name: "New announcement" }),
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Course update" },
  });
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: "Read chapter one." },
  });
}
test("retains draft and request ID after transport failure, and prevents duplicate pending submissions", async () => {
  vi.mocked(api.createAnnouncement).mockRejectedValueOnce(
    new Error("Connection unavailable"),
  );
  open();
  await draft();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Connection unavailable",
  );
  const first = vi.mocked(api.createAnnouncement).mock.calls[0][1];
  let finish!: (value: api.Announcement) => void;
  vi.mocked(api.createAnnouncement).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(api.createAnnouncement).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.createAnnouncement).mock.calls[1][1]).toEqual(first);
  expect(
    screen.getByRole("button", { name: "Publish" }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => finish({} as api.Announcement));
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    "Announcement published. Student notifications are queued.",
  );
});
test("does not update a departed screen after a pending write resolves", async () => {
  let finish!: (value: api.Announcement) => void;
  vi.mocked(api.createAnnouncement).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = open();
  await draft();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  const reads = vi.mocked(api.fetchAnnouncements).mock.calls.length;
  view.unmount();
  await act(async () => finish({} as api.Announcement));
  expect(api.fetchAnnouncements).toHaveBeenCalledTimes(reads);
});
test("offers load retry without displaying stale data", async () => {
  vi.mocked(api.fetchAnnouncements).mockRejectedValueOnce(
    new Error("Server unavailable"),
  );
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No announcements yet.")).toBeTruthy();
});
test.each(["student", "admin"])(
  "limits %s controls to the authorized interface",
  async (role) => {
    identity.role = role;
    vi.mocked(api.fetchAnnouncements).mockResolvedValue({
      data: [
        {
          id: "a",
          courseId: "course",
          title: "Update",
          body: "Message",
          revision: 1,
          publishedAt: "2026-09-22T00:00:00Z",
          createdAt: "2026-09-22T00:00:00Z",
          updatedAt: "2026-09-22T00:00:00Z",
        },
      ],
      nextOffset: null,
    });
    open();
    await screen.findByText("Update");
    expect(
      screen.queryByRole("button", { name: "New announcement" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Update" })).toBeNull();
    if (role === "admin") {
      fireEvent.click(screen.getByRole("button", { name: "Delete Update" }));
      expect(api.deleteAnnouncement).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
      await waitFor(() =>
        expect(api.deleteAnnouncement).toHaveBeenCalledWith("course", "a"),
      );
    } else
      expect(
        screen.queryByRole("button", { name: "Delete Update" }),
      ).toBeNull();
  },
);
