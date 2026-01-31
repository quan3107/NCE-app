/**
 * Location: features/assignments/components/ielts/QuestionEditor.tsx
 * Purpose: Reusable component for editing a single IELTS question with type selector,
 *          prompt editor, options manager, and correct answer input.
 * Why: Centralizes question editing logic to be reused across reading/listening editors.
 */

import { useState } from 'react';
import type {
  IeltsQuestion,
  IeltsQuestionType,
  IeltsCompletionFormat,
  MatchingItem,
  MatchingOption,
  DiagramLabel,
} from '@lib/ielts';
import { IELTS_COMPLETION_FORMATS } from '@lib/ielts';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import type { UploadFile } from '@lib/mock-data';
import { MatchingEditor } from './MatchingEditor';
import { DiagramLabelingEditor } from './DiagramLabelingEditor';

const TRUE_FALSE_OPTIONS = ['true', 'false', 'not given'];
const YES_NO_OPTIONS = ['yes', 'no', 'not given'];

// Types that require options (multiple choice, etc.)
const OPTION_BASED_TYPES: IeltsQuestionType[] = ['multiple_choice'];

// Matching types
const MATCHING_TYPES: IeltsQuestionType[] = [
  'matching',
  'matching_headings',
  'matching_information',
  'matching_features',
];

// Diagram labeling types
const DIAGRAM_LABELING_TYPES: IeltsQuestionType[] = [
  'diagram_labeling',
  'map_diagram_labeling',
];

type QuestionTypeOption = { value: IeltsQuestionType; label: string };

type QuestionEditorProps = {
  question: IeltsQuestion;
  questionNumber: number;
  onChange: (updated: IeltsQuestion) => void;
  onDelete: () => void;
  showDelete?: boolean;
  questionTypes: QuestionTypeOption[];
  // Optional image upload handlers for diagram labeling
  onImageUpload?: (file: File) => Promise<string>;
  onImageRemove?: (imageId: string) => void;
  uploadedImages?: Record<string, UploadFile>;
};

export function QuestionEditor({
  question,
  questionNumber,
  onChange,
  onDelete,
  showDelete = true,
  questionTypes,
  onImageUpload,
  onImageRemove,
  uploadedImages = {},
}: QuestionEditorProps) {
  const [localUploads, setLocalUploads] = useState<Record<string, UploadFile[]>>({});

  const needsOptions = OPTION_BASED_TYPES.includes(question.type);
  const isTrueFalse = question.type === 'true_false_not_given';
  const isYesNo = question.type === 'yes_no_not_given';
  const isCompletion = question.type === 'completion';
  const isMatching = MATCHING_TYPES.includes(question.type);
  const isDiagramLabeling = DIAGRAM_LABELING_TYPES.includes(question.type);

  const createId = () =>
    globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${Math.random()}`;

  const handleTypeChange = (newType: IeltsQuestionType) => {
    // Reset options when switching to/from types that need them
    let newOptions = question.options;
    if (OPTION_BASED_TYPES.includes(newType) && !OPTION_BASED_TYPES.includes(question.type)) {
      newOptions = ['', ''];
    } else if (!OPTION_BASED_TYPES.includes(newType) && OPTION_BASED_TYPES.includes(question.type)) {
      newOptions = [];
    }

    // Reset correct answer when switching to true/false/not given or yes/no/not given
    let newCorrectAnswer = question.correctAnswer;
    if (newType === 'true_false_not_given') {
      newCorrectAnswer = 'true';
    } else if (newType === 'yes_no_not_given') {
      newCorrectAnswer = 'yes';
    } else if (question.type === 'true_false_not_given' || question.type === 'yes_no_not_given') {
      newCorrectAnswer = '';
    }

    const updates: Partial<IeltsQuestion> = {
      type: newType,
      options: newOptions,
      correctAnswer: newCorrectAnswer,
    };

    // Reset format when switching away from completion
    if (newType !== 'completion') {
      updates.format = undefined;
    }

    // Initialize matching data for matching types
    if (MATCHING_TYPES.includes(newType) && !MATCHING_TYPES.includes(question.type)) {
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
    } else if (!MATCHING_TYPES.includes(newType)) {
      updates.matchingItems = undefined;
      updates.matchingOptions = undefined;
    }

    // Initialize diagram data for labeling types
    if (DIAGRAM_LABELING_TYPES.includes(newType) && !DIAGRAM_LABELING_TYPES.includes(question.type)) {
      updates.diagramImageIds = [];
      updates.diagramLabels = [
        { id: createId(), letter: 'A', position: '', answer: '' },
        { id: createId(), letter: 'B', position: '', answer: '' },
        { id: createId(), letter: 'C', position: '', answer: '' },
      ];
    } else if (!DIAGRAM_LABELING_TYPES.includes(newType)) {
      updates.diagramImageIds = undefined;
      updates.diagramLabels = undefined;
    }

    onChange({
      ...question,
      ...updates,
    });
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
    const newOptions = question.options.filter((_, i) => i !== index);
    let newCorrectAnswer = question.correctAnswer;
    if (question.correctAnswer === `${index}`) {
      newCorrectAnswer = '';
    } else {
      const parsed = parseInt(question.correctAnswer);
      if (!isNaN(parsed) && parsed > index) {
        newCorrectAnswer = `${parsed - 1}`;
      }
    }
    onChange({
      ...question,
      options: newOptions,
      correctAnswer: newCorrectAnswer,
    });
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
  const handleMatchingChange = (items: MatchingItem[], options: MatchingOption[]) => {
    onChange({
      ...question,
      matchingItems: items,
      matchingOptions: options,
    });
  };

  // Diagram labeling handlers
  const handleDiagramLabelsChange = (labels: DiagramLabel[]) => {
    onChange({
      ...question,
      diagramLabels: labels,
    });
  };

  const handleDiagramImageFilesChange = (imageId: string, files: UploadFile[]) => {
    setLocalUploads((prev) => ({ ...prev, [imageId]: files }));
    // Update question's image IDs if new image added
    if (files.length > 0 && !question.diagramImageIds?.includes(imageId)) {
      onChange({
        ...question,
        diagramImageIds: [...(question.diagramImageIds || []), imageId],
      });
    }
  };

  const handleDiagramImageRemove = (imageId: string) => {
    setLocalUploads((prev) => {
      const next = { ...prev };
      delete next[imageId];
      return next;
    });
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
          <GripVertical className="size-4 text-muted-foreground cursor-grab" />
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
                {IELTS_COMPLETION_FORMATS.map((format) => (
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
              onImageUpload={onImageUpload || (async () => '')}
              onImageRemove={handleDiagramImageRemove}
              onLabelsChange={handleDiagramLabelsChange}
              onImageFilesChange={handleDiagramImageFilesChange}
            />
          )}

          {/* Options editor for option-based types */}
          {needsOptions && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Answer Options</p>
              <div className="space-y-2">
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-6">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleRemoveOption(index)}
                      disabled={question.options.length <= 2}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleAddOption}
                >
                  <Plus className="size-3.5 mr-1" />
                  Add Option
                </Button>
              </div>
            </div>
          )}

          {/* Correct answer input */}
          {!isMatching && !isDiagramLabeling && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Correct Answer</p>
              {isTrueFalse ? (
                <Select
                  value={question.correctAnswer || 'true'}
                  onValueChange={(value) => onChange({ ...question, correctAnswer: value })}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUE_FALSE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-xs capitalize">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isYesNo ? (
                <Select
                  value={question.correctAnswer || 'yes'}
                  onValueChange={(value) => onChange({ ...question, correctAnswer: value })}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-xs capitalize">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : needsOptions ? (
                <Select
                  value={question.correctAnswer}
                  onValueChange={(value) => onChange({ ...question, correctAnswer: value })}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Select correct option" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((_, index) => (
                      <SelectItem key={index} value={`${index}`} className="text-xs">
                        {String.fromCharCode(65 + index)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={question.correctAnswer}
                  onChange={(e) => onChange({ ...question, correctAnswer: e.target.value })}
                  placeholder="Enter correct answer..."
                  className="h-8 text-sm"
                />
              )}
            </div>
          )}
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
