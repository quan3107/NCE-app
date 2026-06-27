/**
 * Location: features/assignments/components/ielts/IeltsQuestionListEditor.tsx
 * Purpose: Edit IELTS question lists with type-specific fields.
 * Why: Consolidates question editing logic for reading and listening builders.
 */

import { Plus, Trash2 } from 'lucide-react';
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
import type { UploadFile } from '@domain';
import {
  normalizeQuestionOptionValue,
  useBooleanQuestionOptions,
} from '@features/ielts-config/questionOptions.api';
import { StringListEditor } from './StringListEditor';
import { MatchingEditor } from './MatchingEditor';
import { DiagramLabelingEditor } from './DiagramLabelingEditor';
import {
  DIAGRAM_LABELING_TYPES,
  MATCHING_TYPES,
  OPTION_TYPES,
  buildQuestionTypePatch,
  createQuestion,
  type CompletionFormatOption,
  type QuestionTypeOption,
} from './questionListEditor.logic';

type IeltsQuestionListEditorProps = {
  questions: IeltsQuestion[];
  onChange: (questions: IeltsQuestion[]) => void;
  typeOptions: QuestionTypeOption[];
  completionFormats?: CompletionFormatOption[];
  // Optional image upload handlers for diagram labeling
  onImageUpload?: (file: File) => Promise<UploadFile>;
  onUploadBusyChange?: (scopeId: string, busy: boolean) => void;
  onUploadBusyReset?: (scopePrefix: string) => void;
  onImageRemove?: (imageId: string) => void;
  uploadedImages?: Record<string, UploadFile>;
};

export function IeltsQuestionListEditor({
  questions,
  onChange,
  typeOptions,
  completionFormats = [],
  onImageUpload,
  onUploadBusyChange,
  onUploadBusyReset,
  onImageRemove,
  uploadedImages = {},
}: IeltsQuestionListEditorProps) {
  const {
    trueFalseOptions,
    yesNoOptions,
    error: booleanOptionsError,
  } = useBooleanQuestionOptions();
  const defaultTrueFalseValue = trueFalseOptions[0]?.value ?? '';
  const defaultYesNoValue = yesNoOptions[0]?.value ?? '';

  const updateQuestion = (id: string, patch: Partial<IeltsQuestion>) => {
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  };

  const addQuestion = () => {
    const nextType = typeOptions[0]?.value ?? 'multiple_choice';
    onChange([...questions, createQuestion(nextType)]);
  };

  const removeQuestion = (id: string) => {
    onUploadBusyReset?.(`question:${id}:`);
    const next = questions.filter((question) => question.id !== id);
    onChange(next.length ? next : [createQuestion(typeOptions[0]?.value ?? 'multiple_choice')]);
  };

  const handleTypeChange = (id: string, newType: IeltsQuestionType) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    updateQuestion(
      id,
      buildQuestionTypePatch(question, newType, defaultTrueFalseValue, defaultYesNoValue),
    );
  };

  const handleMatchingChange = (id: string, items: MatchingItem[], options: MatchingOption[]) => {
    updateQuestion(id, { matchingItems: items, matchingOptions: options });
  };

  const handleDiagramLabelsChange = (id: string, labels: DiagramLabel[]) => {
    updateQuestion(id, { diagramLabels: labels });
  };

  const handleDiagramImageFilesChange = (questionId: string, imageId: string, files: UploadFile[]) => {
    // Update question's image IDs if new image added
    const question = questions.find((q) => q.id === questionId);
    if (question && files.length > 0 && !question.diagramImageIds?.includes(imageId)) {
      updateQuestion(questionId, {
        diagramImageIds: [...(question.diagramImageIds || []), imageId],
      });
    }
  };

  const handleDiagramImageRemove = (questionId: string, imageId: string) => {
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

  const isBooleanQuestionType = (type: IeltsQuestionType): boolean =>
    type === 'true_false_not_given' || type === 'yes_no_not_given';

  const getBooleanOptions = (type: IeltsQuestionType) => {
    if (type === 'true_false_not_given') {
      return trueFalseOptions;
    }

    return yesNoOptions;
  };

  const getDefaultBooleanValue = (type: IeltsQuestionType): string => {
    if (type === 'true_false_not_given') {
      return defaultTrueFalseValue;
    }

    return defaultYesNoValue;
  };

  const getBooleanAnswerValue = (question: IeltsQuestion): string => {
    const normalized = normalizeQuestionOptionValue(question.correctAnswer || '');
    const options = getBooleanOptions(question.type);

    if (options.some((option) => option.value === normalized)) {
      return normalized;
    }

    return getDefaultBooleanValue(question.type);
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

            {booleanOptionsError && (
              <div className="rounded-[8px] border border-destructive/30 p-3 text-sm" role="alert">
                <p className="font-medium text-destructive">Unable to load boolean answer options.</p>
                <p className="mt-1 text-muted-foreground">{booleanOptionsError.message}</p>
              </div>
            )}

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
                onImageUpload={onImageUpload}
                onUploadBusyChange={(scopeId, busy) =>
                  onUploadBusyChange?.(`question:${question.id}:${scopeId}`, busy)
                }
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
                {isBooleanQuestionType(question.type) && !booleanOptionsError && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Select
                      value={getBooleanAnswerValue(question)}
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
                        {getBooleanOptions(question.type).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!isBooleanQuestionType(question.type) && (
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
