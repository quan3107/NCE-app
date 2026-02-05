/**
 * Location: features/assignments/components/ielts/authoring/ReadingAssignmentForm.tsx
 * Purpose: Render the reading authoring form per Figma layout.
 * Why: Matches the passage accordion and question editor design with drag-drop reordering.
 */

import { useState } from 'react';
import { Plus, Eye, Edit } from 'lucide-react';
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
import { Textarea } from '@components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@components/ui/toggle-group';
import type { IeltsQuestion, IeltsReadingConfig } from '@lib/ielts';
import { useEnabledReadingQuestionTypes, useEnabledCompletionFormats } from '@features/ielts-config/api';
import { SortablePassageCard } from './SortablePassageCard';
import { QuestionEditor } from '../QuestionEditor';
import { IeltsReadingContentPreview } from '../IeltsReadingContentPreview';

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `reading-${Date.now()}-${Math.random()}`;

const createQuestion = (): IeltsQuestion => ({
  id: createId(),
  type: 'multiple_choice',
  prompt: '',
  options: ['', '', '', ''],
  correctAnswer: '',
});

export function ReadingAssignmentForm({
  value,
  onChange,
}: {
  value: IeltsReadingConfig;
  onChange: (value: IeltsReadingConfig) => void;
}) {
  const [expandedPassage, setExpandedPassage] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { data: questionTypes, isLoading: isLoadingQuestionTypes, error: questionTypesError } = useEnabledReadingQuestionTypes();
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

  const addPassage = () => {
    const nextSections = [
      ...value.sections,
      {
        id: createId(),
        title: `Passage ${value.sections.length + 1}`,
        passage: '',
        questions: [],
      },
    ];
    onChange({ ...value, sections: nextSections });
  };

  const updatePassage = (index: number, patch: Partial<IeltsReadingConfig['sections'][0]>) => {
    const nextSections = value.sections.map((section, idx) =>
      idx === index ? { ...section, ...patch } : section,
    );
    onChange({ ...value, sections: nextSections });
  };

  const addQuestion = (passageIndex: number) => {
    const questions = [...value.sections[passageIndex].questions, createQuestion()];
    updatePassage(passageIndex, { questions });
  };

  const removeQuestion = (passageIndex: number, questionIndex: number) => {
    const questions = value.sections[passageIndex].questions.filter(
      (_, idx) => idx !== questionIndex,
    );
    updatePassage(passageIndex, { questions });
  };

  const updateQuestion = (
    passageIndex: number,
    questionIndex: number,
    patch: Partial<IeltsQuestion>,
  ) => {
    const questions = value.sections[passageIndex].questions.map((question, idx) =>
      idx === questionIndex ? { ...question, ...patch } : question,
    );
    updatePassage(passageIndex, { questions });
  };

  const moveQuestion = (passageIndex: number, questionIndex: number, direction: 'up' | 'down') => {
    const questions = [...value.sections[passageIndex].questions];
    const newIndex = direction === 'up' ? questionIndex - 1 : questionIndex + 1;
    
    if (newIndex >= 0 && newIndex < questions.length) {
      [questions[questionIndex], questions[newIndex]] = [questions[newIndex], questions[questionIndex]];
      updatePassage(passageIndex, { questions });
    }
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
            <CardTitle>Reading Passages</CardTitle>
            <CardDescription>Create passages and questions for the reading test</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={isPreviewMode ? 'preview' : 'edit'}
              onValueChange={(value) => setIsPreviewMode(value === 'preview')}
            >
              <ToggleGroupItem value="edit" aria-label="Edit mode">
                <Edit className="mr-2 size-4" />
                Edit
              </ToggleGroupItem>
              <ToggleGroupItem value="preview" aria-label="Preview mode">
                <Eye className="mr-2 size-4" />
                Preview
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={addPassage} size="sm">
              <Plus className="mr-2 size-4" />
              Add Passage
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPreviewMode ? (
          <IeltsReadingContentPreview value={value} />
        ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {value.sections.map((passage, passageIndex) => (
              <SortablePassageCard
                key={passage.id}
                id={passage.id}
                index={passageIndex}
                title={passage.title}
                questionCount={passage.questions.length}
                isExpanded={expandedPassage === passageIndex}
                onToggle={() =>
                  setExpandedPassage(expandedPassage === passageIndex ? -1 : passageIndex)
                }
              >
                <div className="space-y-2">
                  <Label>Passage Title</Label>
                  <Input
                    value={passage.title}
                    onChange={(event) =>
                      updatePassage(passageIndex, { title: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passage Content</Label>
                  <Textarea
                    value={passage.passage}
                    onChange={(event) =>
                      updatePassage(passageIndex, { passage: event.target.value })
                    }
                    rows={8}
                    placeholder="Enter the reading passage text..."
                  />
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button onClick={() => addQuestion(passageIndex)} size="sm" variant="outline">
                      <Plus className="mr-2 size-4" />
                      Add Question
                    </Button>
                  </div>

                  {passage.questions.map((question, questionIndex) => (
                    <Card key={question.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <QuestionEditor
                          question={question}
                          questionNumber={questionIndex + 1}
                          onChange={(updated) => updateQuestion(passageIndex, questionIndex, updated)}
                          onDelete={() => removeQuestion(passageIndex, questionIndex)}
                          showDelete={true}
                          questionTypes={questionTypeOptions}
                          completionFormats={completionFormatOptions}
                          onMoveUp={() => moveQuestion(passageIndex, questionIndex, 'up')}
                          onMoveDown={() => moveQuestion(passageIndex, questionIndex, 'down')}
                          canMoveUp={questionIndex > 0}
                          canMoveDown={questionIndex < passage.questions.length - 1}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </SortablePassageCard>
            ))}
          </SortableContext>
        </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
