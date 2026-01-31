/**
 * Location: features/assignments/components/ielts/QuestionEditor.tsx
 * Purpose: Reusable component for editing a single IELTS question with type selector,
 *          prompt editor, options manager, and correct answer input.
 * Why: Centralizes question editing logic to be reused across reading/listening editors.
 */

import type { IeltsQuestion, IeltsQuestionType } from '@lib/ielts';
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

const QUESTION_TYPES: { value: IeltsQuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false_not_given', label: 'True/False/Not Given' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'summary_completion', label: 'Summary Completion' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'form_completion', label: 'Form Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'map_labeling', label: 'Map Labeling' },
  { value: 'short_answer', label: 'Short Answer' },
];

const TRUE_FALSE_OPTIONS = ['true', 'false', 'not given'];

// Types that require options (multiple choice, matching, etc.)
const OPTION_BASED_TYPES: IeltsQuestionType[] = [
  'multiple_choice',
  'matching_headings',
  'matching_information',
  'matching_features',
  'map_labeling',
];

type QuestionEditorProps = {
  question: IeltsQuestion;
  questionNumber: number;
  onChange: (updated: IeltsQuestion) => void;
  onDelete: () => void;
  showDelete?: boolean;
};

export function QuestionEditor({
  question,
  questionNumber,
  onChange,
  onDelete,
  showDelete = true,
}: QuestionEditorProps) {
  const needsOptions = OPTION_BASED_TYPES.includes(question.type);
  const isTrueFalse = question.type === 'true_false_not_given';

  const handleTypeChange = (newType: IeltsQuestionType) => {
    // Reset options when switching to/from types that need them
    let newOptions = question.options;
    if (OPTION_BASED_TYPES.includes(newType) && !OPTION_BASED_TYPES.includes(question.type)) {
      newOptions = ['', ''];
    } else if (!OPTION_BASED_TYPES.includes(newType) && OPTION_BASED_TYPES.includes(question.type)) {
      newOptions = [];
    }
    
    // Reset correct answer when switching to true/false/not given
    let newCorrectAnswer = question.correctAnswer;
    if (newType === 'true_false_not_given') {
      newCorrectAnswer = 'true';
    } else if (question.type === 'true_false_not_given') {
      newCorrectAnswer = '';
    }

    onChange({
      ...question,
      type: newType,
      options: newOptions,
      correctAnswer: newCorrectAnswer,
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
    // Update correct answer if it referenced the removed option
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
        <div className="flex-1 space-y-3">
          {/* Question type selector */}
          <Select value={question.type} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select question type" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value} className="text-xs">
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Question prompt */}
          <Textarea
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
            placeholder="Enter question prompt..."
            className="min-h-[60px] resize-none text-sm"
          />

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
