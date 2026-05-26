/**
 * Location: features/assignments/components/TeacherAssignmentDetailHeaderActions.tsx
 * Purpose: Render teacher assignment detail header actions for edit/save/unpublish.
 * Why: Keeps the assignment detail route focused on data and workflow state.
 */

import { ArrowLeft, Edit, EyeOff, Save, X } from 'lucide-react';
import { Button } from '@components/ui/button';

type TeacherAssignmentDetailHeaderActionsProps = {
  canEdit: boolean;
  isEditing: boolean;
  isPending: boolean;
  isPublished: boolean;
  onBack: () => void;
  onCancelEdit: () => void;
  onEnterEdit: () => void;
  onSaveEdit: () => void;
  onUnpublish: () => void;
};

export function TeacherAssignmentDetailHeaderActions({
  canEdit,
  isEditing,
  isPending,
  isPublished,
  onBack,
  onCancelEdit,
  onEnterEdit,
  onSaveEdit,
  onUnpublish,
}: TeacherAssignmentDetailHeaderActionsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>
      {isEditing ? (
        <>
          <Button variant="outline" onClick={onCancelEdit} disabled={isPending}>
            <X className="mr-2 size-4" />
            Cancel
          </Button>
          <Button onClick={onSaveEdit} disabled={isPending}>
            <Save className="mr-2 size-4" />
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </>
      ) : (
        <>
          {canEdit && (
            <Button variant="outline" onClick={onEnterEdit}>
              <Edit className="mr-2 size-4" />
              Edit
            </Button>
          )}
          <Button onClick={onUnpublish} variant="secondary" disabled={!isPublished || isPending}>
            <EyeOff className="mr-2 size-4" />
            {isPending ? 'Unpublishing...' : 'Unpublish'}
          </Button>
        </>
      )}
    </div>
  );
}
