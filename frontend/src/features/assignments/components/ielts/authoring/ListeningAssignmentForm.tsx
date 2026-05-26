/**
 * Location: features/assignments/components/ielts/authoring/ListeningAssignmentForm.tsx
 * Purpose: Orchestrate the listening authoring form per Figma layout.
 * Why: Keeps state and drag-drop behavior in one place while child files render large sections.
 */

import { useRef, useState } from 'react';
import { FolderUp, Plus } from 'lucide-react';
import {
  closestCenter,
  DndContext,
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
import type { UploadFile } from '@domain';
import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import {
  useEnabledCompletionFormats,
  useEnabledListeningQuestionTypes,
} from '@features/ielts-config/api';
import { BulkAudioUploadDialog } from './BulkAudioUploadDialog';
import { ListeningSectionEditor } from './ListeningSectionEditor';
import {
  createBulkAudioMatches,
  createListeningAuthoringId,
  createListeningQuestion,
} from './listeningAuthoring.logic';

type ListeningAssignmentFormProps = {
  value: IeltsListeningConfig;
  onChange: (value: IeltsListeningConfig) => void;
  onAudioSelect: (sectionId: string, file: File | null) => void;
};

export function ListeningAssignmentForm({ value, onChange, onAudioSelect }: ListeningAssignmentFormProps) {
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadFile>>({});
  const [uploadedAudio, setUploadedAudio] = useState<Record<string, { file: File; url: string }>>(
    {},
  );
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [bulkMatches, setBulkMatches] = useState<Record<string, File | null>>({});
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const {
    data: questionTypes,
    isLoading: isLoadingQuestionTypes,
    error: questionTypesError,
  } = useEnabledListeningQuestionTypes();
  const {
    data: completionFormats,
    isLoading: isLoadingCompletionFormats,
    error: completionFormatsError,
  } = useEnabledCompletionFormats();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateSection = (index: number, patch: Partial<IeltsListeningConfig['sections'][0]>) => {
    const nextSections = value.sections.map((section, idx) =>
      idx === index ? { ...section, ...patch } : section,
    );
    onChange({ ...value, sections: nextSections });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = value.sections.findIndex((section) => section.id === active.id);
    const newIndex = value.sections.findIndex((section) => section.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextSections = [...value.sections];
    const [movedSection] = nextSections.splice(oldIndex, 1);
    nextSections.splice(newIndex, 0, movedSection);
    onChange({ ...value, sections: nextSections });
  };

  const addSection = () => {
    onChange({
      ...value,
      sections: [
        ...value.sections,
        {
          id: createListeningAuthoringId(),
          title: `Section ${value.sections.length + 1}`,
          audioFileId: null,
          playback: { limitPlays: 1 },
          questions: [],
        },
      ],
    });
  };

  const handleAddQuestion = (sectionIndex: number) => {
    const section = value.sections[sectionIndex];
    updateSection(sectionIndex, { questions: [...section.questions, createListeningQuestion()] });
  };

  const handleUpdateQuestion = (
    sectionIndex: number,
    questionId: string,
    updatedQuestion: IeltsQuestion,
  ) => {
    const section = value.sections[sectionIndex];
    updateSection(sectionIndex, {
      questions: section.questions.map((question) =>
        question.id === questionId ? updatedQuestion : question,
      ),
    });
  };

  const handleDeleteQuestion = (sectionIndex: number, questionId: string) => {
    const section = value.sections[sectionIndex];
    updateSection(sectionIndex, {
      questions: section.questions.filter((question) => question.id !== questionId),
    });
  };

  const moveQuestion = (sectionIndex: number, questionId: string, direction: 'up' | 'down') => {
    const section = value.sections[sectionIndex];
    const questionIndex = section.questions.findIndex((question) => question.id === questionId);
    const nextIndex = direction === 'up' ? questionIndex - 1 : questionIndex + 1;

    if (questionIndex === -1 || nextIndex < 0 || nextIndex >= section.questions.length) {
      return;
    }

    const questions = [...section.questions];
    [questions[questionIndex], questions[nextIndex]] = [questions[nextIndex], questions[questionIndex]];
    updateSection(sectionIndex, { questions });
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const imageId = createListeningAuthoringId();
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

  const handleImageRemove = (imageId: string) => {
    setUploadedImages((prev) => {
      const next = { ...prev };
      if (next[imageId]?.url) {
        URL.revokeObjectURL(next[imageId].url);
      }
      delete next[imageId];
      return next;
    });
  };

  const handleAudioSelect = (sectionId: string, file: File | null) => {
    setUploadedAudio((prev) => {
      const next = { ...prev };
      if (next[sectionId]?.url) {
        URL.revokeObjectURL(next[sectionId].url);
      }
      if (file) {
        next[sectionId] = { file, url: URL.createObjectURL(file) };
      } else {
        delete next[sectionId];
      }
      return next;
    });
    onAudioSelect(sectionId, file);
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) {
      return;
    }

    setBulkUploadFiles(audioFiles);
    setBulkMatches(createBulkAudioMatches(audioFiles, value.sections));
    setShowBulkUploadDialog(true);
  };

  const applyBulkUpload = () => {
    Object.entries(bulkMatches).forEach(([sectionId, file]) => {
      if (file) {
        handleAudioSelect(sectionId, file);
      }
    });
    cancelBulkUpload();
  };

  const cancelBulkUpload = () => {
    setShowBulkUploadDialog(false);
    setBulkUploadFiles([]);
    setBulkMatches({});
  };

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

  const questionTypeOptions = questionTypes?.map((qt) => ({ value: qt.id, label: qt.label })) ?? [];
  const completionFormatOptions =
    completionFormats?.map((cf) => ({ value: cf.id, label: cf.label })) ?? [];

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={value.sections.map((section) => section.id)}
            strategy={verticalListSortingStrategy}
          >
            {value.sections.map((section, index) => (
              <ListeningSectionEditor
                key={section.id}
                section={section}
                sectionIndex={index}
                uploadedAudio={uploadedAudio[section.id]}
                uploadedImages={uploadedImages}
                questionTypeOptions={questionTypeOptions}
                completionFormatOptions={completionFormatOptions}
                onAddQuestion={handleAddQuestion}
                onAudioSelect={handleAudioSelect}
                onDeleteQuestion={handleDeleteQuestion}
                onImageRemove={handleImageRemove}
                onImageUpload={handleImageUpload}
                onMoveQuestion={moveQuestion}
                onUpdateQuestion={handleUpdateQuestion}
                onUpdateSection={updateSection}
              />
            ))}
          </SortableContext>
        </DndContext>

        <BulkAudioUploadDialog
          open={showBulkUploadDialog}
          onOpenChange={setShowBulkUploadDialog}
          files={bulkUploadFiles}
          sections={value.sections}
          bulkMatches={bulkMatches}
          onApply={applyBulkUpload}
          onAssignFileToSection={(sectionId, file) =>
            setBulkMatches((prev) => ({ ...prev, [sectionId]: file }))
          }
          onCancel={cancelBulkUpload}
          onRemoveFileFromSection={(sectionId) =>
            setBulkMatches((prev) => ({ ...prev, [sectionId]: null }))
          }
          onRemoveUnassignedFile={(fileToRemove) =>
            setBulkUploadFiles((prev) => prev.filter((file) => file !== fileToRemove))
          }
        />
      </CardContent>
    </Card>
  );
}
