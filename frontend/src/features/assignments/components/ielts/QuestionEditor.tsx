/**
 * Location: features/assignments/components/ielts/QuestionEditor.tsx
 * Purpose: Reusable component for editing a single IELTS question with type selector,
 *          prompt editor, options manager, and correct answer input.
 * Why: Centralizes question editing logic to be reused across reading/listening editors.
 */

import type {
  IeltsQuestion,
  IeltsQuestionType,
  IeltsCompletionFormat,
} from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import type { UploadFile } from '@domain';
import { useBooleanQuestionOptions } from '@features/ielts-config/questionOptions.api';
import { MatchingEditor } from './MatchingEditor';
import { DiagramLabelingEditor } from './DiagramLabelingEditor';
import { QuestionAnswerControls } from './QuestionAnswerControls';
import {
  DIAGRAM_LABELING_TYPES,
  MATCHING_TYPES,
  OPTION_BASED_TYPES,
  buildQuestionTypeChange,
  removeOptionAtIndex,
  type CompletionFormatOption,
  type QuestionTypeOption,
} from './questionEditor.logic';

type QuestionEditorProps = {
  question: IeltsQuestion;
  questionNumber: number;
  onChange: (updated: IeltsQuestion) => void;
  onDelete: () => void;
  showDelete?: boolean;
  questionTypes: QuestionTypeOption[];
  completionFormats?: CompletionFormatOption[];
  // Optional image upload handlers for diagram labeling
  onImageUpload?: (file: File) => Promise<UploadFile>;
  onImageRemove?: (imageId: string) => void;
  uploadedImages?: Record<string, UploadFile>;
  // Reordering props
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

export function QuestionEditor({
  question,
  questionNumber,
  onChange,
  onDelete,
  showDelete = true,
  questionTypes,
  completionFormats = [],
  onImageUpload,
  onImageRemove,
  uploadedImages = {},
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: QuestionEditorProps) {
  const { trueFalseOptions, yesNoOptions } = useBooleanQuestionOptions();

  const needsOptions = OPTION_BASED_TYPES.includes(question.type);
  const isTrueFalse = question.type === 'true_false_not_given';
  const isYesNo = question.type === 'yes_no_not_given';
  const isCompletion = question.type === 'completion';
  const isMatching = MATCHING_TYPES.includes(question.type);
  const isDiagramLabeling = DIAGRAM_LABELING_TYPES.includes(question.type);
  const defaultTrueFalseValue = trueFalseOptions[0]?.value ?? 'true';
  const defaultYesNoValue = yesNoOptions[0]?.value ?? 'yes';

  const createId = () =>
    globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${Math.random()}`;

  const handleTypeChange = (newType: IeltsQuestionType) => {
    onChange(
      buildQuestionTypeChange({
        question,
        newType,
        defaultTrueFalseValue,
        defaultYesNoValue,
        createId,
      }),
    );
  };

  const handleFormatChange = (format: IeltsCompletionFormat) => {
    onChange({
      ...question,
      format,
    });
  };

  const handleAddOption = () => {
    onChange({
      ...question,
      options: [...question.options, ''],
    });
  };

  const handleRemoveOption = (index: number) => {
    onChange(removeOptionAtIndex(question, index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...question.options];
    newOptions[index] = value;
    onChange({
      ...question,
      options: newOptions,
    });
  };

  // Matching handlers
  const handleMatchingChange = (
    items: NonNullable<IeltsQuestion['matchingItems']>,
    options: NonNullable<IeltsQuestion['matchingOptions']>,
  ) => {
    onChange({
      ...question,
      matchingItems: items,
      matchingOptions: options,
    });
  };

  // Diagram labeling handlers
  const handleDiagramLabelsChange = (
    labels: NonNullable<IeltsQuestion['diagramLabels']>,
  ) => {
    onChange({
      ...question,
      diagramLabels: labels,
    });
  };

  const handleDiagramImageFilesChange = (imageId: string, files: UploadFile[]) => {
    // Update question's image IDs if new image added
    if (files.length > 0 && !question.diagramImageIds?.includes(imageId)) {
      onChange({
        ...question,
        diagramImageIds: [...(question.diagramImageIds || []), imageId],
      });
    }
  };

  const handleDiagramImageRemove = (imageId: string) => {
    if (onImageRemove) {
      onImageRemove(imageId);
    }
    // Remove from question's image IDs
    const updatedIds = (question.diagramImageIds || []).filter((id) => id !== imageId);
    onChange({
      ...question,
      diagramImageIds: updatedIds,
    });
  };

  return (
    <div className="rounded-[10px] border bg-card p-4 space-y-4">
      {/* Header with question number and type selector */}
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 mt-2">
          {(onMoveUp || onMoveDown) ? (
            <div className="flex flex-col gap-0.5">
              {onMoveUp && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 p-0"
                  disabled={!canMoveUp}
                  onClick={onMoveUp}
                >
                  <ArrowUp className="size-3" />
                </Button>
              )}
              {onMoveDown && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 p-0"
                  disabled={!canMoveDown}
                  onClick={onMoveDown}
                >
                  <ArrowDown className="size-3" />
                </Button>
              )}
            </div>
          ) : (
            <GripVertical className="size-4 text-muted-foreground cursor-grab" />
          )}
          <span className="text-sm font-medium text-muted-foreground min-w-[3ch]">
            {questionNumber}.
          </span>
        </div>

        <div className="flex-1 space-y-4">
          {/* Question type selector */}
          <Select value={question.type} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select question type" />
            </SelectTrigger>
            <SelectContent>
              {questionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value} className="text-xs">
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Completion format selector */}
          {isCompletion && (
            <Select
              value={question.format || 'summary'}
              onValueChange={(value) => handleFormatChange(value as IeltsCompletionFormat)}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {completionFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value} className="text-xs">
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Question prompt */}
          <Textarea
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
            placeholder="Enter question prompt..."
            className="min-h-[60px] resize-none text-sm"
          />

          {/* Matching Editor */}
          {isMatching && question.matchingItems && question.matchingOptions && (
            <MatchingEditor
              items={question.matchingItems}
              options={question.matchingOptions}
              onChange={handleMatchingChange}
            />
          )}

          {/* Diagram Labeling Editor */}
          {isDiagramLabeling && (
            <DiagramLabelingEditor
              imageIds={question.diagramImageIds || []}
              labels={question.diagramLabels || []}
              uploadedImages={uploadedImages}
              onImageUpload={onImageUpload}
              onImageRemove={handleDiagramImageRemove}
              onLabelsChange={handleDiagramLabelsChange}
              onImageFilesChange={handleDiagramImageFilesChange}
            />
          )}

          <QuestionAnswerControls
            question={question}
            needsOptions={needsOptions}
            isTrueFalse={isTrueFalse}
            isYesNo={isYesNo}
            isMatching={isMatching}
            isDiagramLabeling={isDiagramLabeling}
            trueFalseOptions={trueFalseOptions}
            yesNoOptions={yesNoOptions}
            defaultTrueFalseValue={defaultTrueFalseValue}
            defaultYesNoValue={defaultYesNoValue}
            onChange={onChange}
            onAddOption={handleAddOption}
            onRemoveOption={handleRemoveOption}
            onOptionChange={handleOptionChange}
          />
        </div>

        {/* Delete button */}
        {showDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
