/**
 * Location: features/admin/components/AdminCmsPage.tsx
 * Purpose: Orchestrate CMS page selection, draft editing, preview, publish, and rollback.
 * Why: Gives administrators one auditable workflow for managing public marketing content.
 */
import { useEffect, useState } from "react";

import { PageHeader } from "@components/common/PageHeader";
import { Card, CardContent } from "@components/ui/card";
import {
  useCmsDraftQuery,
  useCmsPagesQuery,
  useCmsRevisionsQuery,
  usePublishCmsDraftMutation,
  useRollbackCmsRevisionMutation,
  useSaveCmsDraftMutation,
} from "@features/admin/cmsApi";
import type {
  CmsPageContent,
  CmsPageKey,
  CmsPageState,
  CmsRevision,
} from "@features/admin/cmsTypes";
import { ConfirmRollbackDialog } from "./ConfirmRollbackDialog";
import { CmsDraftWorkspace } from "./CmsDraftWorkspace";
import { CmsRevisionHistory } from "./CmsRevisionHistory";
import { DiscardPageChangesDialog } from "./DiscardPageChangesDialog";
import { useCmsUnsavedChangesGuard } from "./useCmsUnsavedChangesGuard";

type CmsEditorState = {
  pageKey: CmsPageKey;
  content: CmsPageContent;
  sourceContent: CmsPageContent;
  baseDraftVersion: number;
};

const toEditorState = (page: CmsPageState): CmsEditorState => ({
  pageKey: page.pageKey,
  content: page.content,
  sourceContent: page.content,
  baseDraftVersion: page.draftVersion,
});

export function AdminCmsPage() {
  const pagesQuery = useCmsPagesQuery();
  const [pageKey, setPageKey] = useState<CmsPageKey>("homepage");
  const draftQuery = useCmsDraftQuery(pageKey);
  const revisionsQuery = useCmsRevisionsQuery(pageKey);
  const saveMutation = useSaveCmsDraftMutation();
  const publishMutation = usePublishCmsDraftMutation();
  const rollbackMutation = useRollbackCmsRevisionMutation();
  const [editor, setEditor] = useState<CmsEditorState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingPageKey, setPendingPageKey] = useState<CmsPageKey | null>(null);
  const [pendingRollback, setPendingRollback] = useState<CmsRevision | null>(
    null,
  );
  const draft = draftQuery.data;
  const content = editor?.pageKey === pageKey ? editor.content : null;

  useEffect(() => {
    const pages = pagesQuery.data?.pages;
    if (pages?.length && !pages.some((page) => page.pageKey === pageKey)) {
      setPageKey(pages[0].pageKey);
    }
  }, [pageKey, pagesQuery.data?.pages]);

  useEffect(() => {
    const incoming = draftQuery.data;
    if (!incoming?.content) return;
    setEditor((current) => {
      if (current?.pageKey === pageKey) {
        const isDirty =
          JSON.stringify(current.content) !==
          JSON.stringify(current.sourceContent);
        const matchesIncoming =
          JSON.stringify(current.content) === JSON.stringify(incoming.content);
        if (isDirty && !matchesIncoming) return current;
      }
      return toEditorState(incoming);
    });
  }, [draftQuery.data?.draftVersion, pageKey]);

  const isBusy =
    saveMutation.isPending ||
    publishMutation.isPending ||
    rollbackMutation.isPending;
  const hasLocalChanges = Boolean(
    editor &&
    JSON.stringify(editor.content) !== JSON.stringify(editor.sourceContent),
  );
  const navigationBlocker = useCmsUnsavedChangesGuard(hasLocalChanges);
  const hasServerConflict = Boolean(
    hasLocalChanges &&
    draft &&
    editor &&
    draft.draftVersion !== editor.baseDraftVersion,
  );
  const hasValidDraft = Boolean(
    !draftQuery.isLoading &&
    !draftQuery.error &&
    draft &&
    editor?.pageKey === pageKey,
  );
  const canPublish = Boolean(draft?.hasUnpublishedChanges || hasLocalChanges);
  const revisions =
    revisionsQuery.data?.pages.flatMap((page) => page.revisions) ?? [];

  const switchPage = (nextPageKey: CmsPageKey) => {
    saveMutation.reset();
    publishMutation.reset();
    rollbackMutation.reset();
    setEditor(null);
    setPageKey(nextPageKey);
    setShowPreview(false);
    setPendingPageKey(null);
  };

  const reloadServerDraft = () => {
    if (!draft) return;
    setEditor(toEditorState(draft));
    setShowPreview(false);
  };

  const overwriteServerDraft = () => {
    if (!draft) return;
    setEditor((current) =>
      current?.pageKey === pageKey
        ? {
            ...current,
            sourceContent: draft.content,
            baseDraftVersion: draft.draftVersion,
          }
        : current,
    );
  };

  return (
    <div>
      <PageHeader
        title="Content management"
        description="Edit drafts, preview changes, publish revisions, and restore earlier content."
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {pagesQuery.error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Unable to load CMS pages. Please refresh and try again.
            </CardContent>
          </Card>
        ) : null}
        {draftQuery.error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Unable to load the page draft. Please refresh and try again.
            </CardContent>
          </Card>
        ) : null}

        <CmsDraftWorkspace
          pageKey={pageKey}
          pages={pagesQuery.data?.pages ?? []}
          draft={draft}
          content={content}
          isLoading={draftQuery.isLoading}
          loadError={draftQuery.error}
          isBusy={isBusy}
          hasLocalChanges={hasLocalChanges}
          hasServerConflict={hasServerConflict}
          canPublish={canPublish}
          showPreview={showPreview}
          saveError={saveMutation.error}
          publishError={publishMutation.error}
          rollbackError={rollbackMutation.error}
          onPageSelect={(nextPageKey) => {
            if (nextPageKey === pageKey) return;
            if (hasLocalChanges) setPendingPageKey(nextPageKey);
            else switchPage(nextPageKey);
          }}
          onContentChange={(nextContent) =>
            setEditor((current) =>
              current ? { ...current, content: nextContent } : current,
            )
          }
          onSave={() =>
            saveMutation.mutate({
              pageKey,
              content: content!,
              expectedDraftVersion: editor!.baseDraftVersion,
            })
          }
          onTogglePreview={() => setShowPreview((visible) => !visible)}
          onPublish={() =>
            publishMutation.mutate({
              pageKey,
              content: content!,
              expectedDraftVersion: editor!.baseDraftVersion,
            })
          }
          onReload={reloadServerDraft}
          onOverwrite={overwriteServerDraft}
        />

        <CmsRevisionHistory
          revisions={revisions}
          currentRevision={draftQuery.data?.publishedRevision}
          isLoading={revisionsQuery.isLoading}
          error={revisionsQuery.error}
          isBusy={
            isBusy || hasServerConflict || !hasValidDraft || hasLocalChanges
          }
          hasNextPage={Boolean(revisionsQuery.hasNextPage)}
          isFetchingNextPage={revisionsQuery.isFetchingNextPage}
          onLoadMore={() => void revisionsQuery.fetchNextPage()}
          onRollback={setPendingRollback}
        />
      </div>

      <DiscardPageChangesDialog
        open={pendingPageKey !== null}
        onCancel={() => setPendingPageKey(null)}
        onConfirm={() => pendingPageKey && switchPage(pendingPageKey)}
      />
      <DiscardPageChangesDialog
        open={navigationBlocker.state === "blocked"}
        description="Leaving this page will discard the edits currently shown."
        confirmLabel="Discard changes and leave"
        onCancel={() =>
          navigationBlocker.state === "blocked" && navigationBlocker.reset()
        }
        onConfirm={() =>
          navigationBlocker.state === "blocked" && navigationBlocker.proceed()
        }
      />
      <ConfirmRollbackDialog
        open={pendingRollback !== null}
        onCancel={() => setPendingRollback(null)}
        onConfirm={() => {
          if (!pendingRollback || !editor) return;
          rollbackMutation.mutate(
            {
              pageKey,
              revisionId: pendingRollback.id,
              expectedDraftVersion: editor.baseDraftVersion,
            },
            {
              onSuccess: (page) => {
                setEditor(toEditorState(page));
                setPendingRollback(null);
                setShowPreview(false);
              },
            },
          );
        }}
      />
    </div>
  );
}
