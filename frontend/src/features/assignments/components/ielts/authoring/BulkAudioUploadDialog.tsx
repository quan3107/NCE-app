/**
 * Location: features/assignments/components/ielts/authoring/BulkAudioUploadDialog.tsx
 * Purpose: Render bulk audio assignment review for listening authoring.
 * Why: Isolates the large dialog markup from the listening form orchestrator.
 */

import { Upload, X } from 'lucide-react';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import type { IeltsListeningConfig } from '@lib/ielts';

type BulkAudioUploadDialogProps = {
  bulkMatches: Record<string, File | null>;
  files: File[];
  onApply: () => void;
  onAssignFileToSection: (sectionId: string, file: File | null) => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onRemoveFileFromSection: (sectionId: string) => void;
  onRemoveUnassignedFile: (file: File) => void;
  open: boolean;
  sections: IeltsListeningConfig['sections'];
};

export function BulkAudioUploadDialog({
  bulkMatches,
  files,
  onApply,
  onAssignFileToSection,
  onCancel,
  onOpenChange,
  onRemoveFileFromSection,
  onRemoveUnassignedFile,
  open,
  sections,
}: BulkAudioUploadDialogProps) {
  const assignedFiles = new Set(Object.values(bulkMatches).filter((file): file is File => file !== null));
  const unassignedFiles = files.filter((file) => !assignedFiles.has(file));
  const appliedFileCount = Object.values(bulkMatches).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Bulk Audio Upload</DialogTitle>
          <DialogDescription>
            Review and adjust the audio file assignments for each section.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Section Assignments</h4>
            {sections.map((section) => {
              const assignedFile = bulkMatches[section.id];

              return (
                <div
                  key={section.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <span className="font-medium min-w-[80px]">{section.title}</span>
                  <div className="flex-1">
                    <Select
                      value={assignedFile ? assignedFile.name : '__none__'}
                      onValueChange={(value) => {
                        if (value === '__none__') {
                          onRemoveFileFromSection(section.id);
                          return;
                        }

                        const selectedFile = files.find((file) => file.name === value);
                        onAssignFileToSection(section.id, selectedFile || null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select audio file..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No file assigned</SelectItem>
                        {files.map((file) => (
                          <SelectItem key={file.name} value={file.name}>
                            {file.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {assignedFile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => onRemoveFileFromSection(section.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {unassignedFiles.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">
                Unassigned Files ({unassignedFiles.length})
              </h4>
              <div className="space-y-2">
                {unassignedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => onRemoveUnassignedFile(file)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <strong>Tip:</strong> Select files from dropdowns to assign them to sections. Files
            can be reassigned freely. Unassigned files won't be uploaded.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 size-4" />
            Cancel
          </Button>
          <Button onClick={onApply}>
            <Upload className="mr-2 size-4" />
            Apply ({appliedFileCount} files)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
