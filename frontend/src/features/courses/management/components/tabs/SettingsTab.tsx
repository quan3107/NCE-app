/**
 * Location: features/courses/management/components/tabs/SettingsTab.tsx
 * Purpose: Render rubric controls and course visibility toggles for teacher management settings.
 * Why: Separating tab markup clarifies the main management screen responsibilities.
 */

import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Archive, RotateCcw } from 'lucide-react';

import type { CourseArchiveHandlers } from '../../hooks/useTeacherCourseManagement';
import type { CourseArchiveState, RubricState } from '../../types';

type SettingsTabProps = {
  rubric: RubricState;
  archive: CourseArchiveState;
  archiveHandlers: CourseArchiveHandlers;
};

export function SettingsTab({ rubric, archive, archiveHandlers }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grading Rubric</CardTitle>
          <CardDescription>Configure the default rubric for this course</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {rubric.criteria.map((criterion) => (
              <div key={criterion.name} className="flex items-center gap-4 p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium">{criterion.name}</p>
                  <p className="text-sm text-muted-foreground">{criterion.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{criterion.weight}</span>
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">Total: {rubric.totalWeight}%</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Course lifecycle controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {archive.errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {archive.errorMessage}
            </p>
          ) : null}
          <ArchiveRow
            isArchived={archive.isArchived}
            isMutating={archive.isMutating}
            onArchive={archiveHandlers.archive}
            onRestore={archiveHandlers.restore}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type ArchiveRowProps = {
  isArchived: boolean;
  isMutating: boolean;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
};

function ArchiveRow({ isArchived, isMutating, onArchive, onRestore }: ArchiveRowProps) {
  const Icon = isArchived ? RotateCcw : Archive;
  const actionLabel = isArchived ? 'Restore' : 'Archive';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{isArchived ? 'Restore Course' : 'Archive Course'}</p>
        <p className="text-sm text-muted-foreground">
          {isArchived ? 'Return to active course lists' : 'Hide from active course lists'}
        </p>
      </div>
      <Button
        variant="outline"
        disabled={isMutating}
        onClick={() => {
          void (isArchived ? onRestore() : onArchive());
        }}
      >
        <Icon className="mr-2 size-4" />
        {isMutating ? 'Saving...' : actionLabel}
      </Button>
    </div>
  );
}
