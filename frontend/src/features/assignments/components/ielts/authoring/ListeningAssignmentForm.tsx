/**
 * Location: features/assignments/components/ielts/authoring/ListeningAssignmentForm.tsx
 * Purpose: Render the listening authoring form per Figma layout.
 * Why: Matches audio upload, playback limit, section list, and question editing design with drag-drop reordering.
 */

import { useState, useRef } from 'react';
import { Plus, Upload, ArrowUp, ArrowDown, FolderUp, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';

import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import { createIeltsAssignmentConfig } from '@lib/ielts';
import { useEnabledListeningQuestionTypes, useEnabledCompletionFormats } from '@features/ielts-config/api';
import type { UploadFile } from '@types/domain';
import { QuestionEditor } from '../QuestionEditor';
import { SortableSectionCard } from './SortableSectionCard';
import { AudioPlayer } from '@components/ui/audio-player';

type ListeningAssignmentFormProps = {
  value: IeltsListeningConfig;
  onChange: (value: IeltsListeningConfig) => void;
  onAudioSelect: (sectionId: string, file: File | null) => void;
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `listening-${Date.now()}-${Math.random()}`;

export function ListeningAssignmentForm({
  value,
  onChange,
  onAudioSelect,
}: ListeningAssignmentFormProps) {
  // Track uploaded images for diagram labeling questions
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadFile>>({});
  // Track uploaded audio files for preview
  const [uploadedAudio, setUploadedAudio] = useState<Record<string, { file: File; url: string }>>({});
  // Bulk upload state
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [bulkMatches, setBulkMatches] = useState<Record<string, File | null>>({});
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const { data: questionTypes, isLoading: isLoadingQuestionTypes, error: questionTypesError } = useEnabledListeningQuestionTypes();
  const { data: completionFormats, isLoading: isLoadingCompletionFormats, error: completionFormatsError } = useEnabledCompletionFormats();

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = value.sections.findIndex((s) => s.id === active.id);
      const newIndex = value.sections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = [...value.sections];
        const [movedSection] = newSections.splice(oldIndex, 1);
        newSections.splice(newIndex, 0, movedSection);
        onChange({ ...value, sections: newSections });
      }
    }
  };

  const addSection = () => {
    const nextSections = [
      ...value.sections,
      {
        id: createId(),
        title: `Section ${value.sections.length + 1}`,
        audioFileId: null,
        playback: { limitPlays: 1 },
        questions: [],
      },
    ];
    onChange({ ...value, sections: nextSections });
  };

  const updateSection = (index: number, patch: Partial<IeltsListeningConfig['sections'][0]>) => {
    const nextSections = value.sections.map((section, idx) =>
      idx === index ? { ...section, ...patch } : section,
    );
    onChange({ ...value, sections: nextSections });
  };

  const toSelectValue = (limitPlays?: number) =>
    limitPlays === 0 ? '999' : String(limitPlays ?? 1);

  const toLimitPlays = (value: string) => (value === '999' ? 0 : Number(value));

  // Question management handlers
  const handleAddQuestion = (sectionIndex: number) => {
    const section = value.sections[sectionIndex];
    const baseConfig = createIeltsAssignmentConfig('listening') as IeltsListeningConfig;
    const baseSection = baseConfig.sections[0];
    const newQuestion: IeltsQuestion = {
      ...baseSection.questions[0],
      id: createId(),
      type: 'multiple_choice',
      prompt: '',
      options: ['', '', '', ''],
      correctAnswer: '',
    };
    updateSection(sectionIndex, {
      questions: [...section.questions, newQuestion],
    });
  };

  const handleUpdateQuestion = (
    sectionIndex: number,
    questionId: string,
    updatedQuestion: IeltsQuestion
  ) => {
    const section = value.sections[sectionIndex];
    const updatedQuestions = section.questions.map((q) =>
      q.id === questionId ? updatedQuestion : q
    );
    updateSection(sectionIndex, { questions: updatedQuestions });
  };

  const handleDeleteQuestion = (sectionIndex: number, questionId: string) => {
    const section = value.sections[sectionIndex];
    const updatedQuestions = section.questions.filter((q) => q.id !== questionId);
    updateSection(sectionIndex, { questions: updatedQuestions });
  };

  const moveQuestion = (sectionIndex: number, questionId: string, direction: 'up' | 'down') => {
    const section = value.sections[sectionIndex];
    const questionIndex = section.questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) return;

    const newIndex = direction === 'up' ? questionIndex - 1 : questionIndex + 1;
    if (newIndex < 0 || newIndex >= section.questions.length) return;

    const updatedQuestions = [...section.questions];
    [updatedQuestions[questionIndex], updatedQuestions[newIndex]] = [
      updatedQuestions[newIndex],
      updatedQuestions[questionIndex],
    ];
    updateSection(sectionIndex, { questions: updatedQuestions });
  };

  // Image upload handler for diagram labeling
  const handleImageUpload = async (file: File): Promise<string> => {
    // Create UploadFile for temporary blob URL
    const imageId = createId();
    const uploadFile: UploadFile = {
      id: imageId,
      name: file.name,
      size: file.size,
      mime: file.type,
      url: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    };
    
    setUploadedImages((prev) => ({ ...prev, [imageId]: uploadFile }));
    return imageId;
  };

  // Image removal handler
  const handleImageRemove = (imageId: string) => {
    setUploadedImages((prev) => {
      const next = { ...prev };
      // Revoke object URL to prevent memory leaks
      if (next[imageId]?.url) {
        URL.revokeObjectURL(next[imageId].url);
      }
      delete next[imageId];
      return next;
    });
  };

  // Audio file selection handler
  const handleAudioSelect = (sectionId: string, file: File | null) => {
    if (file) {
      // Create object URL for preview
      const url = URL.createObjectURL(file);
      setUploadedAudio((prev) => ({ ...prev, [sectionId]: { file, url } }));
    } else {
      // Remove audio file
      setUploadedAudio((prev) => {
        const next = { ...prev };
        if (next[sectionId]?.url) {
          URL.revokeObjectURL(next[sectionId].url);
        }
        delete next[sectionId];
        return next;
      });
    }
    // Call parent handler
    onAudioSelect(sectionId, file);
  };

  // Auto-match filename to section based on naming patterns
  const matchFileToSection = (filename: string, sections: typeof value.sections): string | null => {
    const lowerName = filename.toLowerCase();
    
    // Pattern matching for Section 1, 2, 3, 4
    for (let i = 1; i <= 4; i++) {
      const patterns = [
        `section${i}`,
        `section_${i}`,
        `section-${i}`,
        `section ${i}`,
        `part${i}`,
        `part_${i}`,
        `part-${i}`,
        `part ${i}`,
        `s${i}`,
        `p${i}`,
        `${i}`
      ];
      
      // Check if filename contains any pattern
      const hasPattern = patterns.some(pattern => 
        lowerName.includes(pattern) || lowerName.includes(`${i}`)
      );
      
      if (hasPattern) {
        // Find section with matching index (i-1 for 0-based array)
        const sectionIndex = i - 1;
        if (sectionIndex < sections.length) {
          return sections[sectionIndex].id;
        }
      }
    }
    
    return null;
  };

  // Handle bulk file upload
  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Filter only audio files
    const audioFiles = Array.from(files).filter(file => 
      file.type.startsWith('audio/')
    );

    if (audioFiles.length === 0) return;

    setBulkUploadFiles(audioFiles);

    // Auto-match files to sections
    const matches: Record<string, File | null> = {};
    const matchedFiles = new Set<File>();

    // Initialize all sections as null (no match)
    value.sections.forEach(section => {
      matches[section.id] = null;
    });

    // Try to match each file to a section
    audioFiles.forEach(file => {
      const sectionId = matchFileToSection(file.name, value.sections);
      if (sectionId && !matchedFiles.has(file)) {
        matches[sectionId] = file;
        matchedFiles.add(file);
      }
    });

    setBulkMatches(matches);
    setShowBulkUploadDialog(true);
  };

  // Apply bulk upload matches
  const applyBulkUpload = () => {
    Object.entries(bulkMatches).forEach(([sectionId, file]) => {
      if (file) {
        handleAudioSelect(sectionId, file);
      }
    });
    
    setShowBulkUploadDialog(false);
    setBulkUploadFiles([]);
    setBulkMatches({});
  };

  // Cancel bulk upload
  const cancelBulkUpload = () => {
    setShowBulkUploadDialog(false);
    setBulkUploadFiles([]);
    setBulkMatches({});
  };

  // Get all files assigned to sections
  const getAssignedFiles = (): Set<File> => {
    return new Set(Object.values(bulkMatches).filter((file): file is File => file !== null));
  };

  // Get unassigned files (files not assigned to any section)
  const getUnassignedFiles = (): File[] => {
    const assignedFiles = getAssignedFiles();
    return bulkUploadFiles.filter(file => !assignedFiles.has(file));
  };

  // Handle manual file assignment to a section
  const handleAssignFileToSection = (sectionId: string, file: File | null) => {
    setBulkMatches(prev => ({
      ...prev,
      [sectionId]: file
    }));
  };

  // Handle removing a file from a section
  const handleRemoveFileFromSection = (sectionId: string) => {
    setBulkMatches(prev => ({
      ...prev,
      [sectionId]: null
    }));
  };

  // Handle removing a file from unassigned list
  const handleRemoveUnassignedFile = (fileToRemove: File) => {
    setBulkUploadFiles(prev => prev.filter(file => file !== fileToRemove));
  };

  // Get available files for a section dropdown (all uploaded files)
  const getAvailableFilesForSection = (): File[] => {
    return bulkUploadFiles;
  };

  // Show loading or error state
  if (isLoadingQuestionTypes || isLoadingCompletionFormats) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading IELTS configuration...</p>
        </CardContent>
      </Card>
    );
  }

  if (questionTypesError || completionFormatsError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">Failed to load IELTS configuration</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page or contact support if the problem persists.
          </p>
        </CardContent>
      </Card>
    );
  }

  const questionTypeOptions = questionTypes?.map(qt => ({ value: qt.id, label: qt.label })) ?? [];
  const completionFormatOptions = completionFormats?.map(cf => ({ value: cf.id, label: cf.label })) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Listening Sections</CardTitle>
            <CardDescription>Upload audio and create questions for each section</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => bulkInputRef.current?.click()}>
              <FolderUp className="mr-2 size-4" />
              Bulk Upload
            </Button>
            <input
              ref={bulkInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleBulkUpload}
              className="hidden"
            />
            <Button onClick={addSection} size="sm">
              <Plus className="mr-2 size-4" />
              Add Section
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {value.sections.map((section, index) => (
              <SortableSectionCard
                key={section.id}
                id={section.id}
                index={index}
                title={section.title}
                questionCount={section.questions.length}
                hasAudio={!!uploadedAudio[section.id] || !!section.audioFileId}
              >

              <div className="space-y-2">
                <Label>Audio File</Label>
                {uploadedAudio[section.id] ? (
                  <div className="space-y-3">
                    <AudioPlayer
                      audioUrl={uploadedAudio[section.id].url}
                      fileName={uploadedAudio[section.id].file.name}
                      fileSize={uploadedAudio[section.id].file.size}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(event) =>
                          handleAudioSelect(section.id, event.target.files?.[0] ?? null)
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleAudioSelect(section.id, null)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={(event) =>
                        handleAudioSelect(section.id, event.target.files?.[0] ?? null)
                      }
                    />
                    <Button variant="outline">
                      <Upload className="mr-2 size-4" />
                      Upload
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Playback Limit</Label>
                <Select
                  value={toSelectValue(section.playback?.limitPlays)}
                  onValueChange={(value) =>
                    updateSection(index, { playback: { limitPlays: toLimitPlays(value) } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 time (IELTS standard)</SelectItem>
                    <SelectItem value="2">2 times</SelectItem>
                    <SelectItem value="999">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Questions list */}
              <div className="space-y-3">
                {section.questions.map((question, questionIndex) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    questionNumber={questionIndex + 1}
                    questionTypes={questionTypeOptions}
                    completionFormats={completionFormatOptions}
                    onChange={(updated) => handleUpdateQuestion(index, question.id, updated)}
                    onDelete={() => handleDeleteQuestion(index, question.id)}
                    showDelete={section.questions.length > 1}
                    onImageUpload={handleImageUpload}
                    onImageRemove={handleImageRemove}
                    uploadedImages={uploadedImages}
                    onMoveUp={() => moveQuestion(index, question.id, 'up')}
                    onMoveDown={() => moveQuestion(index, question.id, 'down')}
                    canMoveUp={questionIndex > 0}
                    canMoveDown={questionIndex < section.questions.length - 1}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleAddQuestion(index)}
              >
                <Plus className="mr-2 size-4" />
                Add Question to Section
              </Button>
              </SortableSectionCard>
            ))}
          </SortableContext>
        </DndContext>

        {/* Bulk Upload Confirmation Dialog */}
        <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm Bulk Audio Upload</DialogTitle>
              <DialogDescription>
                Review and adjust the audio file assignments for each section.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Section assignments with dropdowns */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Section Assignments</h4>
                {value.sections.map((section) => {
                  const assignedFile = bulkMatches[section.id];
                  return (
                    <div
                      key={section.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <span className="font-medium min-w-[80px]">{section.title}</span>
                      <div className="flex-1">
                        <Select
                          value={assignedFile ? assignedFile.name : "__none__"}
                          onValueChange={(value) => {
                            if (value === "__none__") {
                              handleRemoveFileFromSection(section.id);
                            } else {
                              const selectedFile = bulkUploadFiles.find(f => f.name === value);
                              handleAssignFileToSection(section.id, selectedFile || null);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select audio file..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No file assigned</SelectItem>
                            {getAvailableFilesForSection().map((file) => (
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
                          onClick={() => handleRemoveFileFromSection(section.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unassigned files section */}
              {getUnassignedFiles().length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Unassigned Files ({getUnassignedFiles().length})
                  </h4>
                  <div className="space-y-2">
                    {getUnassignedFiles().map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                      >
                        <span className="text-sm">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => handleRemoveUnassignedFile(file)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <strong>Tip:</strong> Select files from dropdowns to assign them to sections. Files can be reassigned freely. Unassigned files won't be uploaded.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={cancelBulkUpload}>
                <X className="mr-2 size-4" />
                Cancel
              </Button>
              <Button onClick={applyBulkUpload}>
                <Upload className="mr-2 size-4" />
                Apply ({Object.values(bulkMatches).filter(Boolean).length} files)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
