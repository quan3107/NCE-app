/**
 * Location: features/admin/components/CmsRevisionHistory.tsx
 * Purpose: Render bounded CMS revision metadata and pagination controls.
 * Why: Revision history must stay usable without transferring every full snapshot.
 */
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import type { CmsRevision } from '@features/admin/cmsTypes';

type CmsRevisionHistoryProps = {
  revisions: CmsRevision[];
  currentRevision?: number;
  isLoading: boolean;
  error: unknown;
  isBusy: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRollback: (revision: CmsRevision) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

export function CmsRevisionHistory({
  revisions,
  currentRevision,
  isLoading,
  error,
  isBusy,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRollback,
}: CmsRevisionHistoryProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Revision history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading revisions…</p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Unable to load revision history. Please try again.
          </p>
        ) : revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published revisions yet.</p>
        ) : revisions.map((revision) => (
          <div
            key={revision.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="text-sm">
              <p className="font-medium">
                Revision {revision.revisionNumber} · {revision.operation}
              </p>
              <p className="text-muted-foreground">
                {revision.createdBy?.fullName ?? 'System'} · {formatDate(revision.createdAt)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy || revision.revisionNumber === currentRevision}
              aria-label={`Roll back to revision ${revision.revisionNumber}`}
              onClick={() => onRollback(revision)}
            >
              Roll back
            </Button>
          </div>
        ))}
        {hasNextPage && !error ? (
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? 'Loading revisions…' : 'Load more revisions'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
