/**
 * Location: features/assignments/components/ielts/IeltsQuestionListEditor.tsx
 * Purpose: Edit IELTS question lists with type-specific fields.
 * Why: Consolidates question editing logic for reading and listening builders.
 */

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import type {
  IeltsQuestion,
  IeltsQuestionType,
  IeltsCompletionFormat,
  MatchingItem,
  MatchingOption,
  DiagramLabel,
} from '@lib/ielts';
import type { UploadFile } from '@types/domain';
import {
  normalizeQuestionOptionValue,
  useBooleanQuestionOptions,
} from '@features/ielts-config/questionOptions.api';
import { StringListEditor } from './StringListEditor';
import { MatchingEditor } from './MatchingEditor';
import { DiagramLabelingEditor } from './DiagramLabelingEditor';

type QuestionTypeOption = {
  value: IeltsQuestionType;
  label: string;
};

type CompletionFormatOption = {
  value: IeltsCompletionFormat;
  label: string;
};

type IeltsQuestionListEditorProps = {
  questions: IeltsQuestion[];
  onChange: (questions: IeltsQuestion[]) => void;
  typeOptions: QuestionTypeOption[];
  completionFormats?: CompletionFormatOption[];
  // Optional image upload handlers for diagram labeling
  onImageUpload?: (file: File) => Promise<string>;
  onImageRemove?: (imageId: string) => void;
  uploadedImages?: Record<string, UploadFile>;
};

const OPTION_TYPES = new Set<IeltsQuestionType>([
  'multiple_choice',
]);

const MATCHING_TYPES = new Set<IeltsQuestionType>([
  'matching',
  'matching_headings',
  'matching_information',
  'matching_features',
]);

const DIAGRAM_LABELING_TYPES = new Set<IeltsQuestionType>([
  'diagram_labeling',
  'map_diagram_labeling',
]);

const createId = () => globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}`;

const createQuestion = (type: IeltsQuestionType): IeltsQuestion => {
  const baseOptions = type === 'completion' ? ['', ''] : [''];
  const question: IeltsQuestion = {
    id: createId(),
    type,
    prompt: '',
    options: baseOptions,
    correctAnswer: '',
  };

  // Initialize format for completion types
  if (type === 'completion') {
    question.format = 'summary';
  }

  // Initialize matching data for matching types
  if (MATCHING_TYPES.has(type)) {
    question.matchingItems = [
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
      { id: createId(), statement: '', matchId: null },
    ];
    question.matchingOptions = [
      { id: createId(), label: 'A' },
      { id: createId(), label: 'B' },
      { id: createId(), label: 'C' },
      { id: createId(), label: 'D' },
    ];
  }

  // Initialize diagram data for labeling types
  if (DIAGRAM_LABELING_TYPES.has(type)) {
    question.diagramImageIds = [];
    question.diagramLabels = [
      { id: createId(), letter: 'A', position: '', answer: '' },
      { id: createId(), letter: 'B', position: '', answer: '' },
      { id: createId(), letter: 'C', position: '', answer: '' },
    ];
  }

  return question;
};

export function IeltsQuestionListEditor({
  questions,
  onChange,
  typeOptions,
  completionFormats = [],
  onImageUpload,
  onImageRemove,
  uploadedImages = {},
}: IeltsQuestionListEditorProps) {
  const [localUploads, setLocalUploads] = useState<Record<string, Record<string, UploadFile[]>>>({});
  const { trueFalseOptions, yesNoOptions } = useBooleanQuestionOptions();
  const defaultTrueFalseValue = trueFalseOptions[0]?.value ?? 'true';
  const defaultYesNoValue = yesNoOptions[0]?.value ?? 'yes';

  const updateQuestion = (id: string, patch: Partial<IeltsQuestion>) => {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  };

  const addQuestion = () => {
    const nextType = typeOptions[0]?.value ?? 'multiple_choice';
    onChange([...questions, createQuestion(nextType)]);
  };

  const removeQuestion = (id: string) => {
    const next = questions.filter((question) => question.id !== id);
    onChange(next.length ? next : [createQuestion(typeOptions[0]?.value ?? 'multiple_choice')]);
  };

  const handleTypeChange = (id: string, newType: IeltsQuestionType) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    const updates: Partial<IeltsQuestion> = { type: newType };

    // Initialize matching data for matching types
    if (MATCHING_TYPES.has(newType) && !MATCHING_TYPES.has(question.type)) {
      updates.matchingItems = [
        { id: createId(), statement: '', matchId: null },
        { id: createId(), statement: '', matchId: null },
        { id: createId(), statement: '', matchId: null },
      ];
      updates.matchingOptions = [
        { id: createId(), label: 'A' },
        { id: createId(), label: 'B' },
        { id: createId(), label: 'C' },
        { id: createId(), label: 'D' },
      ];
    } else if (!MATCHING_TYPES.has(newType)) {
      updates.matchingItems = undefined;
      updates.matchingOptions = undefined;
    }

    // Initialize diagram data for labeling types
    if (DIAGRAM_LABELING_TYPES.has(newType) && !DIAGRAM_LABELING_TYPES.has(question.type)) {
      updates.diagramImageIds = [];
      updates.diagramLabels = [
        { id: createId(), letter: 'A', position: '', answer: '' },
        { id: createId(), letter: 'B', position: '', answer: '' },
        { id: createId(), letter: 'C', position: '', answer: '' },
      ];
    } else if (!DIAGRAM_LABELING_TYPES.has(newType)) {
      updates.diagramImageIds = undefined;
      updates.diagramLabels = undefined;
    }

    // Reset options when switching types
    if (OPTION_TYPES.has(newType) && !OPTION_TYPES.has(question.type)) {
      updates.options = ['', ''];
    } else if (!OPTION_TYPES.has(newType) && OPTION_TYPES.has(question.type)) {
      updates.options = [];
    }

    // Reset format
    if (newType !== 'completion') {
      updates.format = undefined;
    } else {
      updates.format = 'summary';
    }

    // Reset correct answer for specific types
    if (newType === 'true_false_not_given') {
      updates.correctAnswer = defaultTrueFalseValue;
    } else if (newType === 'yes_no_not_given') {
      updates.correctAnswer = defaultYesNoValue;
    } else if (!MATCHING_TYPES.has(newType) && !DIAGRAM_LABELING_TYPES.has(newType)) {
      updates.correctAnswer = '';
    }

    updateQuestion(id, updates);
  };

  const handleMatchingChange = (id: string, items: MatchingItem[], options: MatchingOption[]) => {
    updateQuestion(id, { matchingItems: items, matchingOptions: options });
  };

  const handleDiagramLabelsChange = (id: string, labels: DiagramLabel[]) => {
    updateQuestion(id, { diagramLabels: labels });
  };

  const handleDiagramImageFilesChange = (questionId: string, imageId: string, files: UploadFile[]) => {
    setLocalUploads((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [imageId]: files,
      },
    }));

    // Update question's image IDs if new image added
    const question = questions.find((q) => q.id === questionId);
    if (question && files.length > 0 && !question.diagramImageIds?.includes(imageId)) {
      updateQuestion(questionId, {
        diagramImageIds: [...(question.diagramImageIds || []), imageId],
      });
    }
  };

  const handleDiagramImageRemove = (questionId: string, imageId: string) => {
    setLocalUploads((prev) => {
      const questionUploads = { ...prev[questionId] };
      delete questionUploads[imageId];
      return { ...prev, [questionId]: questionUploads };
    });

    if (onImageRemove) {
      onImageRemove(imageId);
    }

    // Remove from question's image IDs
    const question = questions.find((q) => q.id === questionId);
    if (question) {
      const updatedIds = (question.diagramImageIds || []).filter((id) => id !== imageId);
      updateQuestion(questionId, { diagramImageIds: updatedIds });
    }
  };

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <Card key={question.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Label>Question {index + 1}</Label>
              <Select
                value={question.type}
                onValueChange={(value) => handleTypeChange(question.id, value as IeltsQuestionType)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeQuestion(question.id)}
              aria-label={`Remove question ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                rows={3}
                value={question.prompt}
                onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                placeholder="Write the question prompt or instruction."
              />
            </div>

            {/* Completion format selector */}
            {question.type === 'completion' && (
              <div className="space-y-2">
                <Label>Completion Format</Label>
                <Select
                  value={question.format || 'summary'}
                  onValueChange={(value) =>
                    updateQuestion(question.id, { format: value as IeltsCompletionFormat })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
              <SelectContent>
                {completionFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
                </Select>
              </div>
            )}

            {/* Matching Editor */}
            {MATCHING_TYPES.has(question.type) && question.matchingItems && question.matchingOptions && (
              <MatchingEditor
                items={question.matchingItems}
                options={question.matchingOptions}
                onChange={(items, options) => handleMatchingChange(question.id, items, options)}
              />
            )}

            {/* Diagram Labeling Editor */}
            {DIAGRAM_LABELING_TYPES.has(question.type) && (
              <DiagramLabelingEditor
                imageIds={question.diagramImageIds || []}
                labels={question.diagramLabels || []}
                uploadedImages={uploadedImages}
                onImageUpload={onImageUpload || (async () => '')}
                onImageRemove={(imageId) => handleDiagramImageRemove(question.id, imageId)}
                onLabelsChange={(labels) => handleDiagramLabelsChange(question.id, labels)}
                onImageFilesChange={(imageId, files) =>
                  handleDiagramImageFilesChange(question.id, imageId, files)
                }
              />
            )}

            {/* Options for multiple choice */}
            {OPTION_TYPES.has(question.type) && (
              <StringListEditor
                label="Options"
                values={question.options}
                onChange={(options) => updateQuestion(question.id, { options })}
                placeholder="Option text"
                addLabel="Add option"
                dense
              />
            )}

            {/* Correct answer for non-matching, non-diagram types */}
            {!MATCHING_TYPES.has(question.type) && !DIAGRAM_LABELING_TYPES.has(question.type) && (
              <>
                {question.type === 'true_false_not_given' || question.type === 'yes_no_not_given' ? (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Select
                      value={
                        (
                          question.type === 'true_false_not_given'
                            ? trueFalseOptions
                            : yesNoOptions
                        ).some(
                          (option) =>
                            option.value ===
                            normalizeQuestionOptionValue(question.correctAnswer || ''),
                        )
                          ? normalizeQuestionOptionValue(question.correctAnswer || '')
                          : question.type === 'true_false_not_given'
                            ? defaultTrueFalseValue
                            : defaultYesNoValue
                      }
                      onValueChange={(value) =>
                        updateQuestion(question.id, {
                          correctAnswer: normalizeQuestionOptionValue(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          question.type === 'true_false_not_given'
                            ? trueFalseOptions
                            : yesNoOptions
                        ).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Input
                      value={question.correctAnswer}
                      placeholder="Correct response"
                      onChange={(event) =>
                        updateQuestion(question.id, { correctAnswer: event.target.value })
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion}>
        <Plus className="mr-2 size-4" />
        Add Question
      </Button>
    </div>
  );
}
