/**
 * Location: features/assignments/components/TeacherAssignmentContentTab.tsx
 * Purpose: Render the assignment content tab with IELTS preview or editor based on edit mode.
 * Why: Conditionally shows either read-only preview or inline editor for IELTS content.
 */

import type { Assignment } from '@lib/mock-data';
import type { IeltsAssignmentConfig, IeltsAssignmentType } from '@lib/ielts';
import { isIeltsAssignmentType } from '@lib/ielts';
import { IeltsAssignmentContentPreview } from './ielts/IeltsAssignmentContentPreview';
import { IeltsAssignmentContentEditor } from './ielts/IeltsAssignmentContentEditor';

type TeacherAssignmentContentTabProps = {
  assignment: Assignment;
  ieltsConfig: IeltsAssignmentConfig | null;
  isEditing?: boolean;
  onDraftConfigChange?: (updated: IeltsAssignmentConfig) => void;
};

export function TeacherAssignmentContentTab({
  assignment,
  ieltsConfig,
  isEditing = false,
  onDraftConfigChange,
}: TeacherAssignmentContentTabProps) {
  if (isIeltsAssignmentType(assignment.type) && ieltsConfig) {
    if (isEditing && onDraftConfigChange) {
      return (
        <IeltsAssignmentContentEditor
          type={assignment.type as IeltsAssignmentType}
          value={ieltsConfig}
          onChange={onDraftConfigChange}
        />
      );
    }

    return (
      <IeltsAssignmentContentPreview
        type={assignment.type as IeltsAssignmentType}
        value={ieltsConfig}
      />
    );
  }

  // Fallback for non-IELTS assignments
  return (
    <div className="rounded-[14px] border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        {assignment.description || 'No content available.'}
      </p>
    </div>
  );
}
