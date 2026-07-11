/**
 * Location: tests/adminCms.component.test.tsx
 * Purpose: Verify administrators can edit, save, publish, and roll back CMS content.
 * Why: The management UI is the primary completion path for the CMS workflow.
 */
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, test, vi } from "vitest";

import { renderAdminCmsPage } from "./adminCms.test-utils";

const saveMutate = vi.hoisted(() => vi.fn());
const publishMutate = vi.hoisted(() => vi.fn());
const rollbackMutate = vi.hoisted(() => vi.fn());
const saveReset = vi.hoisted(() => vi.fn());
const publishReset = vi.hoisted(() => vi.fn());
const rollbackReset = vi.hoisted(() => vi.fn());
const fetchNextPage = vi.hoisted(() => vi.fn());
const cmsState = vi.hoisted(() => ({
  draftVersion: 1,
  hasUnpublishedChanges: true,
  pagesError: null as Error | null,
  draftError: null as Error | null,
  revisionError: null as Error | null,
  saveError: null as Error | null,
  publishError: null as Error | null,
  rollbackError: null as Error | null,
  hasNextPage: false,
  draftLoading: false,
}));

vi.mock("@features/admin/cmsApi", () => ({
  isCmsVersionConflict: (error: unknown) =>
    (error as { status?: number } | null)?.status === 409,
  useCmsPagesQuery: () => ({
    data: {
      pages: [
        {
          pageKey: "homepage",
          label: "Homepage",
          draftVersion: 1,
          publishedDraftVersion: 0,
          publishedRevision: 0,
          publishedAt: null,
          hasUnpublishedChanges: true,
        },
        {
          pageKey: "about",
          label: "About Page",
          draftVersion: 1,
          publishedDraftVersion: 1,
          publishedRevision: 1,
          publishedAt: null,
          hasUnpublishedChanges: false,
        },
        {
          pageKey: "contact",
          label: "Contact Page",
          draftVersion: 1,
          publishedDraftVersion: 1,
          publishedRevision: 0,
          publishedAt: null,
          hasUnpublishedChanges: false,
        },
      ],
    },
    isLoading: false,
    error: cmsState.pagesError,
  }),
  useCmsDraftQuery: (pageKey: string) => ({
    data: {
      pageKey,
      label:
        pageKey === "contact"
          ? "Contact Page"
          : pageKey === "about"
            ? "About Page"
            : "Homepage",
      content:
        pageKey === "contact"
          ? {
              header: { title: "Contact us", description: "Get in touch." },
              form: {
                title: "Message us",
                description: "We can help.",
                submitLabel: "Send",
              },
              details: {
                email: "support@example.com",
                phone: "123",
                address: "Office",
              },
              hours: [{ label: "Weekdays", value: "9 to 5" }],
            }
          : pageKey === "about"
            ? {
                hero: {
                  title: "About NCE",
                  description: "Our teaching mission.",
                },
                values: [
                  {
                    icon: "target",
                    title: "Student success",
                    description: "Learners come first.",
                  },
                ],
                story: { sections: ["We started with expert teachers."] },
              }
            : {
                hero: {
                  badge: "Badge",
                  title: "Original title",
                  description: "Description",
                  cta_primary: "Browse",
                  cta_secondary: "Login",
                },
                stats: [{ label: "Learners", value: 42, format: "number" }],
                howItWorks: {
                  title: "How it works",
                  description: "Steps",
                  features: [
                    {
                      icon: "book-open",
                      title: "Practice tasks",
                      description: "Use real tasks.",
                    },
                  ],
                },
              },
      draftVersion: cmsState.draftVersion,
      publishedDraftVersion: 0,
      publishedRevision: 0,
      publishedAt: null,
      hasUnpublishedChanges: cmsState.hasUnpublishedChanges,
    },
    isLoading: cmsState.draftLoading,
    error: cmsState.draftError,
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
              createdBy: { id: "admin-1", fullName: "Admin User" },
              sourceRevision: null,
            },
          ],
          nextCursor: null,
        },
      ],
    },
    isLoading: false,
    error: cmsState.revisionError,
    hasNextPage: cmsState.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage,
  }),
  useSaveCmsDraftMutation: () => ({
    mutate: saveMutate,
    reset: saveReset,
    isPending: false,
    error: cmsState.saveError,
  }),
  usePublishCmsDraftMutation: () => ({
    mutate: publishMutate,
    reset: publishReset,
    isPending: false,
    error: cmsState.publishError,
  }),
  useRollbackCmsRevisionMutation: () => ({
    mutate: rollbackMutate,
    reset: rollbackReset,
    isPending: false,
    error: cmsState.rollbackError,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cmsState.draftVersion = 1;
  cmsState.hasUnpublishedChanges = true;
  cmsState.pagesError = null;
  cmsState.draftError = null;
  cmsState.revisionError = null;
  cmsState.saveError = null;
  cmsState.publishError = null;
  cmsState.rollbackError = null;
  cmsState.hasNextPage = false;
  cmsState.draftLoading = false;
});

test("admin CMS page submits edited drafts, publishes, and rolls back", () => {
  renderAdminCmsPage();

  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Updated title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Original title" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Roll back to revision 1" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm rollback" }));

  assert.equal(saveMutate.mock.calls[0]?.[0].pageKey, "homepage");
  assert.equal(
    saveMutate.mock.calls[0]?.[0].content.hero.title,
    "Updated title",
  );
  assert.equal(saveMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
  assert.equal(publishMutate.mock.calls[0]?.[0].pageKey, "homepage");
  assert.equal(
    publishMutate.mock.calls[0]?.[0].content.hero.title,
    "Updated title",
  );
  assert.equal(publishMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
  assert.deepEqual(rollbackMutate.mock.calls[0]?.[0], {
    pageKey: "homepage",
    revisionId: "revision-1",
    expectedDraftVersion: 1,
  });
});

test("renders the current local homepage draft as a public-page preview", () => {
  renderAdminCmsPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Unsaved preview title" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));

  const preview = screen.getByRole("region", {
    name: "Homepage draft preview",
  });
  assert.ok(preview.textContent?.includes("Unsaved preview title"));
  assert.ok(preview.textContent?.includes("Learners"));
  assert.ok(preview.textContent?.includes("Practice tasks"));
  assert.equal(preview.textContent?.includes('\"howItWorks\"'), false);
});

test("renders About and Contact drafts with their public content structure", () => {
  renderAdminCmsPage();

  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "about" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));
  const aboutPreview = screen.getByRole("region", {
    name: "About draft preview",
  });
  assert.ok(aboutPreview.textContent?.includes("Student success"));
  assert.ok(
    aboutPreview.textContent?.includes("We started with expert teachers."),
  );

  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "contact" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));
  const contactPreview = screen.getByRole("region", {
    name: "Contact draft preview",
  });
  assert.ok(contactPreview.textContent?.includes("support@example.com"));
  assert.ok(contactPreview.textContent?.includes("Weekdays"));
  assert.ok(contactPreview.textContent?.includes("9 to 5"));
});

test("publishes unsaved displayed content when the saved draft has no changes", () => {
  cmsState.hasUnpublishedChanges = false;
  renderAdminCmsPage();

  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Unsaved reviewed title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));

  assert.equal(
    publishMutate.mock.calls[0]?.[0].content.hero.title,
    "Unsaved reviewed title",
  );
  assert.equal(publishMutate.mock.calls[0]?.[0].expectedDraftVersion, 1);
});

test("shows revision, save, publish, and rollback failures", () => {
  cmsState.revisionError = new Error("revision failed");
  cmsState.saveError = new Error("save failed");
  cmsState.publishError = new Error("publish failed");
  cmsState.rollbackError = new Error("rollback failed");
  renderAdminCmsPage();

  assert.ok(
    screen.getByText("Unable to load revision history. Please try again."),
  );
  assert.ok(screen.getByText("Unable to save the draft. Please try again."));
  assert.ok(
    screen.getByText("Unable to publish the draft. Reload and try again."),
  );
  assert.ok(
    screen.getByText("Unable to roll back the revision. Please try again."),
  );
  assert.ok(screen.queryByText("No published revisions yet.") === null);
});

test("retains dirty content with its base version when the server draft advances", () => {
  const view = renderAdminCmsPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Locally reviewed title" },
  });

  act(() => {
    cmsState.draftVersion = 2;
    view.rerenderPage();
  });

  assert.equal(
    screen.getByLabelText("Hero title").getAttribute("value"),
    "Locally reviewed title",
  );
  assert.ok(
    screen.getByText(
      "This draft changed on the server. Reload before saving or publishing.",
    ),
  );
  assert.equal(
    (screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement)
      .disabled,
    true,
  );

  assert.ok(
    screen.getByText(
      "Overwriting will replace every newer server change with the complete local draft.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Overwrite server draft" }),
  );
  assert.equal(
    screen.getByLabelText("Hero title").getAttribute("value"),
    "Locally reviewed title",
  );
  assert.equal(
    (screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement)
      .disabled,
    false,
  );
  assert.ok(
    screen.queryByText(
      "This draft changed on the server. Reload before saving or publishing.",
    ) === null,
  );
});

test("reloads the latest server draft when resolving a version conflict", () => {
  const view = renderAdminCmsPage();
  fireEvent.change(screen.getByLabelText("Hero title"), {
    target: { value: "Discard this local title" },
  });

  act(() => {
    cmsState.draftVersion = 2;
    view.rerenderPage();
  });
  fireEvent.click(screen.getByRole("button", { name: "Reload server draft" }));

  assert.equal(
    screen.getByLabelText("Hero title").getAttribute("value"),
    "Original title",
  );
  assert.equal(
    (screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("disables rollback while the selected draft is loading", () => {
  cmsState.draftLoading = true;
  renderAdminCmsPage();

  assert.equal(
    (
      screen.getByRole("button", {
        name: "Roll back to revision 1",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
});

test("shows page-list and draft-load failures distinctly", () => {
  cmsState.pagesError = new Error("pages failed");
  cmsState.draftError = new Error("draft failed");
  renderAdminCmsPage();

  assert.ok(
    screen.getByText("Unable to load CMS pages. Please refresh and try again."),
  );
  assert.ok(
    screen.getByText(
      "Unable to load the page draft. Please refresh and try again.",
    ),
  );
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Roll back to revision 1",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  assert.ok(screen.queryByText("Loading page draft…") === null);
});

test("switching page types never renders the previous draft through the new editor", async () => {
  renderAdminCmsPage();

  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "contact" },
  });

  assert.equal(
    (await screen.findByLabelText("Header title")).getAttribute("value"),
    "Contact us",
  );
});

test("switching pages clears page-scoped mutation errors", async () => {
  renderAdminCmsPage();

  fireEvent.change(screen.getByLabelText("Marketing page"), {
    target: { value: "about" },
  });

  await screen.findByLabelText("Hero description");
  assert.equal(saveReset.mock.calls.length, 1);
  assert.equal(publishReset.mock.calls.length, 1);
  assert.equal(rollbackReset.mock.calls.length, 1);
});
