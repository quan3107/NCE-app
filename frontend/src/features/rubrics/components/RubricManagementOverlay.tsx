/**
 * Location: features/rubrics/components/RubricManagementOverlay.tsx
 * Purpose: Full-screen overlay for managing rubrics without leaving assignment editing.
 * Why: Allows teachers to create/edit rubrics and immediately return to assignment editing.
 */

import { useCallback } from 'react';
import { TeacherRubricsPage } from './TeacherRubricsPage';
import { Button } from '@components/ui/button';
import { X } from 'lucide-react';

type RubricManagementOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
};

export function RubricManagementOverlay({
  isOpen,
  onClose,
  courseId,
}: RubricManagementOverlayProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Manage Rubrics</h2>
          <p className="text-sm text-muted-foreground">
            Create and edit rubrics for your assignments. Changes will be saved automatically when you close.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClose}>
          <X className="mr-2 size-4" />
          Done
        </Button>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-73px)] overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <TeacherRubricsPage embedded courseId={courseId} />
        </div>
      </div>
    </div>
  );
}
