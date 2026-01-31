/**
 * Location: features/assignments/components/ielts/authoring/ListeningAssignmentForm.tsx
 * Purpose: Render the listening authoring form per Figma layout.
 * Why: Matches audio upload, playback limit, section list, and question editing design with drag-drop reordering.
 */

import { useState } from 'react';
import { Plus, Upload, ArrowUp, ArrowDown } from 'lucide-react';
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

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import { IELTS_LISTENING_QUESTION_TYPES, createIeltsAssignmentConfig } from '@lib/ielts';
import type { UploadFile } from '@lib/mock-data';
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
    const baseConfig = createIeltsAssignmentConfig('listening');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Listening Sections</CardTitle>
            <CardDescription>Upload audio and create questions for each section</CardDescription>
          </div>
          <Button onClick={addSection} size="sm">
            <Plus className="mr-2 size-4" />
            Add Section
          </Button>
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
                    questionTypes={IELTS_LISTENING_QUESTION_TYPES}
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
      </CardContent>
    </Card>
  );
}
