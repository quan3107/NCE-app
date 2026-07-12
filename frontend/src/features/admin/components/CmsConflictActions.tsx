/**
 * Location: features/admin/components/CmsConflictActions.tsx
 * Purpose: Present explicit reload and overwrite choices after CMS version conflicts.
 * Why: A full-draft overwrite must clearly warn about replacing another admin's work.
 */
import { Button } from '@components/ui/button';

type CmsConflictActionsProps = {
  onReload: () => void;
  onOverwrite: () => void;
};

export function CmsConflictActions({
  onReload,
  onOverwrite,
}: CmsConflictActionsProps) {
  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 p-3" role="alert">
      <p className="text-sm text-destructive">
        This draft changed on the server. Reload before saving or publishing.
      </p>
      <p className="text-sm text-destructive">
        Overwriting will replace every newer server change with the complete local draft.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onReload}>
          Reload server draft
        </Button>
        <Button type="button" variant="secondary" onClick={onOverwrite}>
          Overwrite server draft
        </Button>
      </div>
    </div>
  );
}
