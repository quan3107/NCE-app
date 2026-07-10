/**
 * Location: features/admin/components/CmsConflictActions.tsx
 * Purpose: Present explicit reload and rebase choices after CMS version conflicts.
 * Why: Retrying a stale editor version cannot succeed without an administrator decision.
 */
import { Button } from '@components/ui/button';

type CmsConflictActionsProps = {
  onReload: () => void;
  onRebase: () => void;
};

export function CmsConflictActions({
  onReload,
  onRebase,
}: CmsConflictActionsProps) {
  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 p-3" role="alert">
      <p className="text-sm text-destructive">
        This draft changed on the server. Reload before saving or publishing.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onReload}>
          Reload server draft
        </Button>
        <Button type="button" variant="secondary" onClick={onRebase}>
          Rebase my changes
        </Button>
      </div>
    </div>
  );
}
