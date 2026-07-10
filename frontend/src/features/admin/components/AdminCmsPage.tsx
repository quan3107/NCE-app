/**
 * Location: features/admin/components/AdminCmsPage.tsx
 * Purpose: Orchestrate CMS page selection, draft editing, preview, publish, and rollback.
 * Why: Gives administrators one auditable workflow for managing public marketing content.
 */
import { useEffect, useState } from 'react';

import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import {
  isCmsVersionConflict,
  useCmsDraftQuery,
  useCmsPagesQuery,
  useCmsRevisionsQuery,
  usePublishCmsDraftMutation,
  useRollbackCmsRevisionMutation,
  useSaveCmsDraftMutation,
} from '@features/admin/cmsApi';
import type {
  CmsPageContent,
  CmsPageKey,
  CmsPageState,
  CmsRevision,
} from '@features/admin/cmsTypes';
import { ConfirmRollbackDialog } from './ConfirmRollbackDialog';
import { CmsConflictActions } from './CmsConflictActions';
import { CmsContentEditor } from './CmsContentEditor';
import { CmsRevisionHistory } from './CmsRevisionHistory';
import { DiscardPageChangesDialog } from './DiscardPageChangesDialog';
import { useCmsUnsavedChangesGuard } from './useCmsUnsavedChangesGuard';

type CmsEditorState = {
  pageKey: CmsPageKey;
  content: CmsPageContent;
  sourceContent: CmsPageContent;
  baseDraftVersion: number;
};

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : 'Not published yet';

const toEditorState = (page: CmsPageState): CmsEditorState => ({
  pageKey: page.pageKey,
  content: page.content,
  sourceContent: page.content,
  baseDraftVersion: page.draftVersion,
});

export function AdminCmsPage() {
  const pagesQuery = useCmsPagesQuery();
  const [pageKey, setPageKey] = useState<CmsPageKey>('homepage');
  const draftQuery = useCmsDraftQuery(pageKey);
  const revisionsQuery = useCmsRevisionsQuery(pageKey);
  const saveMutation = useSaveCmsDraftMutation();
  const publishMutation = usePublishCmsDraftMutation();
  const rollbackMutation = useRollbackCmsRevisionMutation();
  const [editor, setEditor] = useState<CmsEditorState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingPageKey, setPendingPageKey] = useState<CmsPageKey | null>(null);
  const [pendingRollback, setPendingRollback] = useState<CmsRevision | null>(null);
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
        const isDirty = JSON.stringify(current.content) !== JSON.stringify(current.sourceContent);
        const matchesIncoming = JSON.stringify(current.content) === JSON.stringify(incoming.content);
        if (isDirty && !matchesIncoming) return current;
      }
      return toEditorState(incoming);
    });
  }, [draftQuery.data?.draftVersion, pageKey]);

  const isBusy =
    saveMutation.isPending || publishMutation.isPending || rollbackMutation.isPending;
  const hasLocalChanges = Boolean(
    editor && JSON.stringify(editor.content) !== JSON.stringify(editor.sourceContent),
  );
  const navigationBlocker = useCmsUnsavedChangesGuard(hasLocalChanges);
  const hasServerConflict = Boolean(
    hasLocalChanges && draft && editor && draft.draftVersion !== editor.baseDraftVersion,
  );
  const hasValidDraft = Boolean(
    !draftQuery.isLoading && !draftQuery.error && draft && editor?.pageKey === pageKey,
  );
  const canPublish = Boolean(draft?.hasUnpublishedChanges || hasLocalChanges);
  const revisions = revisionsQuery.data?.pages.flatMap((page) => page.revisions) ?? [];

  const switchPage = (nextPageKey: CmsPageKey) => {
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

  const rebaseLocalChanges = () => {
    if (!draft) return;
    setEditor((current) => current?.pageKey === pageKey ? {
      ...current,
      sourceContent: draft.content,
      baseDraftVersion: draft.draftVersion,
    } : current);
  };

  return (
    <div>
      <PageHeader
        title="Content management"
        description="Edit drafts, preview changes, publish revisions, and restore earlier content."
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {pagesQuery.error ? (
          <Card><CardContent className="py-6 text-sm text-destructive">
            Unable to load CMS pages. Please refresh and try again.
          </CardContent></Card>
        ) : null}
        {draftQuery.error ? (
          <Card><CardContent className="py-6 text-sm text-destructive">
            Unable to load the page draft. Please refresh and try again.
          </CardContent></Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle>Page draft</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="cms-page">Marketing page</Label>
              <select
                id="cms-page"
                value={pageKey}
                onChange={(event) => {
                  const nextPageKey = event.target.value as CmsPageKey;
                  if (nextPageKey === pageKey) return;
                  if (hasLocalChanges) setPendingPageKey(nextPageKey);
                  else switchPage(nextPageKey);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(pagesQuery.data?.pages ?? []).map((page) => (
                  <option key={page.pageKey} value={page.pageKey}>{page.label}</option>
                ))}
              </select>
            </div>

            {draftQuery.error ? null : draftQuery.isLoading || !content || !draft ? (
              <p className="text-sm text-muted-foreground">Loading page draft…</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/45 p-3 text-sm">
                  <span>Published revision {draft.publishedRevision}</span>
                  <span>•</span>
                  <span>{formatDate(draft.publishedAt)}</span>
                  {draft.hasUnpublishedChanges ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                      Unpublished changes
                    </span>
                  ) : null}
                </div>

                <CmsContentEditor
                  pageKey={pageKey}
                  content={content}
                  onChange={(nextContent) => setEditor((current) =>
                    current ? { ...current, content: nextContent } : current)}
                />

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={isBusy || !hasLocalChanges || hasServerConflict}
                    onClick={() => saveMutation.mutate({
                      pageKey, content, expectedDraftVersion: editor!.baseDraftVersion,
                    })}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => setShowPreview((visible) => !visible)}
                  >
                    {showPreview ? 'Hide preview' : 'Preview draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isBusy || !canPublish || hasServerConflict}
                    onClick={() => publishMutation.mutate({
                      pageKey, content, expectedDraftVersion: editor!.baseDraftVersion,
                    })}
                  >
                    Publish
                  </Button>
                </div>

                {hasServerConflict ? (
                  <CmsConflictActions
                    onReload={reloadServerDraft}
                    onRebase={rebaseLocalChanges}
                  />
                ) : null}
                {saveMutation.error && !isCmsVersionConflict(saveMutation.error) ? (
                  <p className="text-sm text-destructive" role="alert">
                    Unable to save the draft. Please try again.
                  </p>
                ) : null}
                {publishMutation.error && !isCmsVersionConflict(publishMutation.error) ? (
                  <p className="text-sm text-destructive" role="alert">
                    Unable to publish the draft. Reload and try again.
                  </p>
                ) : null}
                {rollbackMutation.error && !isCmsVersionConflict(rollbackMutation.error) ? (
                  <p className="text-sm text-destructive" role="alert">
                    Unable to roll back the revision. Please try again.
                  </p>
                ) : null}

                {showPreview ? (
                  <Card className="bg-muted/20">
                    <CardHeader><CardTitle>Draft preview</CardTitle></CardHeader>
                    <CardContent><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(content, null, 2)}
                    </pre></CardContent>
                  </Card>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <CmsRevisionHistory
          revisions={revisions}
          currentRevision={draftQuery.data?.publishedRevision}
          isLoading={revisionsQuery.isLoading}
          error={revisionsQuery.error}
          isBusy={isBusy || hasServerConflict || !hasValidDraft}
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
        open={navigationBlocker.state === 'blocked'}
        description="Leaving this page will discard the edits currently shown."
        confirmLabel="Discard changes and leave"
        onCancel={() => navigationBlocker.state === 'blocked' && navigationBlocker.reset()}
        onConfirm={() => navigationBlocker.state === 'blocked' && navigationBlocker.proceed()}
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
