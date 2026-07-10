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
  useCmsDraftQuery,
  useCmsPagesQuery,
  useCmsRevisionsQuery,
  usePublishCmsDraftMutation,
  useRollbackCmsRevisionMutation,
  useSaveCmsDraftMutation,
} from '@features/admin/cmsApi';
import type { CmsPageContent, CmsPageKey } from '@features/admin/cmsTypes';
import { CmsContentEditor } from './CmsContentEditor';

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'Not published yet';
}

export function AdminCmsPage() {
  const pagesQuery = useCmsPagesQuery();
  const [pageKey, setPageKey] = useState<CmsPageKey>('homepage');
  const draftQuery = useCmsDraftQuery(pageKey);
  const revisionsQuery = useCmsRevisionsQuery(pageKey);
  const saveMutation = useSaveCmsDraftMutation();
  const publishMutation = usePublishCmsDraftMutation();
  const rollbackMutation = useRollbackCmsRevisionMutation();
  const [content, setContent] = useState<CmsPageContent | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const draft = draftQuery.data;

  useEffect(() => {
    const pages = pagesQuery.data?.pages;
    if (pages?.length && !pages.some((page) => page.pageKey === pageKey)) {
      setPageKey(pages[0].pageKey);
    }
  }, [pageKey, pagesQuery.data?.pages]);

  useEffect(() => {
    if (draftQuery.data?.content) setContent(draftQuery.data.content);
  }, [draftQuery.data?.draftVersion, pageKey]);

  const isBusy =
    saveMutation.isPending || publishMutation.isPending || rollbackMutation.isPending;
  const error = pagesQuery.error ?? draftQuery.error;

  return (
    <div>
      <PageHeader
        title="Content management"
        description="Edit drafts, preview changes, publish revisions, and restore earlier content."
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Unable to load CMS content. Please refresh and try again.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Page draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="cms-page">Marketing page</Label>
              <select
                id="cms-page"
                value={pageKey}
                onChange={(event) => {
                  setContent(null);
                  setPageKey(event.target.value as CmsPageKey);
                  setShowPreview(false);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {(pagesQuery.data?.pages ?? []).map((page) => (
                  <option key={page.pageKey} value={page.pageKey}>
                    {page.label}
                  </option>
                ))}
              </select>
            </div>

            {draftQuery.isLoading || !content || !draft ? (
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

                <CmsContentEditor pageKey={pageKey} content={content} onChange={setContent} />

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={isBusy}
                    onClick={() => saveMutation.mutate({ pageKey, content })}
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
                    disabled={isBusy || !draft.hasUnpublishedChanges}
                    onClick={() => publishMutation.mutate(pageKey)}
                  >
                    Publish
                  </Button>
                </div>

                {showPreview ? (
                  <Card className="bg-muted/20">
                    <CardHeader><CardTitle>Draft preview</CardTitle></CardHeader>
                    <CardContent>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">
                        {JSON.stringify(content, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revision history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {revisionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading revisions…</p>
            ) : (revisionsQuery.data?.revisions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No published revisions yet.</p>
            ) : (
              revisionsQuery.data?.revisions.map((revision) => (
                <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="text-sm">
                    <p className="font-medium">Revision {revision.revisionNumber} · {revision.operation}</p>
                    <p className="text-muted-foreground">
                      {revision.createdBy?.fullName ?? 'System'} · {formatDate(revision.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy || revision.revisionNumber === draftQuery.data?.publishedRevision}
                    aria-label={`Roll back to revision ${revision.revisionNumber}`}
                    onClick={() => rollbackMutation.mutate({ pageKey, revisionId: revision.id })}
                  >
                    Roll back
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
