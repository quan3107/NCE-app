/**
 * Location: tests/adminCms.guards.component.test.tsx
 * Purpose: Verify CMS edit guards, rollback rebasing, and revision pagination.
 * Why: Destructive transitions must be deliberate and must preserve version consistency.
 */
import assert from "node:assert/strict";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

import { renderAdminCmsPage } from "./adminCms.test-utils";

const saveMutate = vi.hoisted(() => vi.fn());
const publishMutate = vi.hoisted(() => vi.fn());
const rollbackMutate = vi.hoisted(() => vi.fn());
const fetchNextPage = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ hasNextPage: false }));

const homepageContent = {
  hero: {
    badge: "Badge",
    title: "Original title",
    description: "Description",
    cta_primary: "Browse",
    cta_secondary: "Login",
  },
  stats: [],
  howItWorks: { title: "How it works", description: "Steps", features: [] },
};

vi.mock("@features/admin/cmsApi", () => ({
  isCmsVersionConflict: (error: unknown) =>
    (error as { status?: number } | null)?.status === 409,
  useCmsPagesQuery: () => ({
    data: {
      pages: [
        { pageKey: "homepage", label: "Homepage" },
        { pageKey: "contact", label: "Contact Page" },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useCmsDraftQuery: (pageKey: string) => ({
    data: {
      pageKey,
      label: pageKey === "contact" ? "Contact Page" : "Homepage",
      content:
        pageKey === "contact"
          ? {
              header: { title: "Contact us", description: "Get in touch." },
              form: {
                title: "Message us",
                description: "Help",
                submitLabel: "Send",
              },
              details: {
                email: "support@example.com",
                phone: "123",
                address: "Office",
              },
              hours: [],
            }
          : homepageContent,
      draftVersion: 3,
      publishedDraftVersion: 3,
      publishedRevision: 2,
      publishedAt: null,
      hasUnpublishedChanges: false,
    },
    isLoading: false,
    error: null,
  }),
  useCmsRevisionsQuery: () => ({
    data: {
      pages: [
        {
          revisions: [
            {
              id: "revision-1",
              revisionNumber: 1,
              operation: "publish",
              createdAt: "2026-07-01T00:00:00.000Z",
              createdBy: null,
              sourceRevision: null,
            },
          ],
          nextCursor: state.hasNextPage ? "revision-1" : null,
        },
      ],
    },
    isLoading: false,
    error: null,
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage,
  }),
  useSaveCmsDraftMutation: () => ({
    mutate: saveMutate,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  usePublishCmsDraftMutation: () => ({
    mutate: publishMutate,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useRollbackCmsRevisionMutation: () => ({
    mutate: rollbackMutate,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.hasNextPage = false;
});

const renderPage = () => renderAdminCmsPage();

test("disables Save until local content changes", () => {
  renderPage();
  assert.equal(
    (screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Edited" },
  });
  assert.equal(
    (screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement)
      .disabled,
    false,
  );
});

test("keeps dirty edits until page switching is explicitly confirmed", () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Edited" },
  });
  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "contact" },
  });

  assert.equal(
    (screen.getByLabelText("Marketing page") as HTMLSelectElement).value,
    "homepage",
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  assert.equal(
    screen.getByLabelText("Hero title").getAttribute("value"),
    "Edited",
  );

  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "contact" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Discard changes and switch" }),
  );
  assert.equal(
    (screen.getByLabelText("Marketing page") as HTMLSelectElement).value,
    "contact",
  );
});

test("requires local edits to be discarded before rollback", () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Unsaved title" },
  });
  const rollbackButton = screen.getByRole("button", {
    name: "Roll back to revision 1",
  });

  assert.equal((rollbackButton as HTMLButtonElement).disabled, true);
  fireEvent.click(rollbackButton);
  assert.equal(rollbackMutate.mock.calls.length, 0);

  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Original title" },
  });
  assert.equal((rollbackButton as HTMLButtonElement).disabled, false);
  fireEvent.click(rollbackButton);
  fireEvent.click(screen.getByRole("button", { name: "Confirm rollback" }));

  assert.deepEqual(rollbackMutate.mock.calls[0]?.[0], {
    pageKey: "homepage",
    revisionId: "revision-1",
    expectedDraftVersion: 3,
  });
});

test("loads the next bounded revision page on demand", () => {
  state.hasNextPage = true;
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Load more revisions" }));
  assert.equal(fetchNextPage.mock.calls.length, 1);
});

test("warns before the browser unloads a dirty CMS draft", () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Edited" },
  });
  const event = new Event("beforeunload", { cancelable: true });

  window.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
});

test("blocks route navigation until dirty changes are explicitly discarded", async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Edited" },
  });
  fireEvent.click(screen.getByRole("link", { name: "Leave CMS" }));

  assert.equal(screen.queryByText("Other page"), null);
  assert.ok(
    screen.getByText(
      "Leaving this page will discard the edits currently shown.",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  assert.equal(
    screen.getByLabelText("Hero title").getAttribute("value"),
    "Edited",
  );

  fireEvent.click(screen.getByRole("link", { name: "Leave CMS" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Discard changes and leave" }),
  );
  assert.ok(await screen.findByText("Other page"));
});
