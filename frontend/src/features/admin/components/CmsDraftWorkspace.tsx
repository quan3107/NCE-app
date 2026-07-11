/**
 * Location: features/admin/components/CmsDraftWorkspace.tsx
 * Purpose: Render CMS page selection, structured editing, mutation controls, and local preview.
 * Why: Keeps the route orchestrator focused on state transitions and conflict handling.
 */
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Label } from "@components/ui/label";
import { isCmsVersionConflict } from "@features/admin/cmsApi";
import type {
  CmsPageContent,
  CmsPageKey,
  CmsPageState,
  CmsPageSummary,
} from "@features/admin/cmsTypes";
import { CmsConflictActions } from "./CmsConflictActions";
import { CmsContentEditor } from "./CmsContentEditor";
import { CmsDraftPreview } from "./CmsDraftPreview";

type CmsDraftWorkspaceProps = {
  pageKey: CmsPageKey;
  pages: CmsPageSummary[];
  draft: CmsPageState | undefined;
  content: CmsPageContent | null;
  isLoading: boolean;
  loadError: unknown;
  isBusy: boolean;
  hasLocalChanges: boolean;
  hasServerConflict: boolean;
  canPublish: boolean;
  showPreview: boolean;
  saveError: unknown;
  publishError: unknown;
  rollbackError: unknown;
  onPageSelect: (pageKey: CmsPageKey) => void;
  onContentChange: (content: CmsPageContent) => void;
  onSave: () => void;
  onTogglePreview: () => void;
  onPublish: () => void;
  onReload: () => void;
  onOverwrite: () => void;
};

export function CmsDraftWorkspace(props: CmsDraftWorkspaceProps) {
  const { content, draft, pageKey } = props;

  return (
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
            onChange={(event) =>
              props.onPageSelect(event.target.value as CmsPageKey)
            }
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {props.pages.map((page) => (
              <option key={page.pageKey} value={page.pageKey}>
                {page.label}
              </option>
            ))}
          </select>
        </div>

        {props.loadError ? null : props.isLoading || !content || !draft ? (
          <p className="text-sm text-muted-foreground">Loading page draft…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/45 p-3 text-sm">
              <span>Published revision {draft.publishedRevision}</span>
              <span>•</span>
              <span>
                {draft.publishedAt
                  ? new Date(draft.publishedAt).toLocaleString()
                  : "Not published yet"}
              </span>
              {draft.hasUnpublishedChanges ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                  Unpublished changes
                </span>
              ) : null}
            </div>

            <CmsContentEditor
              pageKey={pageKey}
              content={content}
              onChange={props.onContentChange}
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={
                  props.isBusy ||
                  !props.hasLocalChanges ||
                  props.hasServerConflict
                }
                onClick={props.onSave}
              >
                Save draft
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={props.isBusy}
                onClick={props.onTogglePreview}
              >
                {props.showPreview ? "Hide preview" : "Preview draft"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  props.isBusy || !props.canPublish || props.hasServerConflict
                }
                onClick={props.onPublish}
              >
                Publish
              </Button>
            </div>

            {props.hasServerConflict ? (
              <CmsConflictActions
                onReload={props.onReload}
                onOverwrite={props.onOverwrite}
              />
            ) : null}
            {props.saveError && !isCmsVersionConflict(props.saveError) ? (
              <p className="text-sm text-destructive" role="alert">
                Unable to save the draft. Please try again.
              </p>
            ) : null}
            {props.publishError && isCmsVersionConflict(props.publishError) ? (
              <p className="text-sm text-destructive" role="alert">
                The draft changed before it could be published. Review the
                refreshed draft and try again.
              </p>
            ) : null}
            {props.publishError && !isCmsVersionConflict(props.publishError) ? (
              <p className="text-sm text-destructive" role="alert">
                Unable to publish the draft. Reload and try again.
              </p>
            ) : null}
            {props.rollbackError &&
            isCmsVersionConflict(props.rollbackError) ? (
              <p className="text-sm text-destructive" role="alert">
                The draft changed before the revision could be restored. Review
                the refreshed draft and try again.
              </p>
            ) : null}
            {props.rollbackError &&
            !isCmsVersionConflict(props.rollbackError) ? (
              <p className="text-sm text-destructive" role="alert">
                Unable to roll back the revision. Please try again.
              </p>
            ) : null}

            {props.showPreview ? (
              <CmsDraftPreview pageKey={pageKey} content={content} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
