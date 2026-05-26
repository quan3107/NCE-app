/**
 * Location: features/assignments/components/ielts/QuestionAnswerControls.tsx
 * Purpose: Render option editing and correct-answer controls for an IELTS question.
 * Why: Keeps QuestionEditor focused on question layout and high-level editor wiring.
 */

import type { IeltsQuestion } from '@lib/ielts';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { normalizeQuestionOptionValue } from '@features/ielts-config/questionOptions.api';

type BooleanAnswerOption = {
  value: string;
  label: string;
};

type QuestionAnswerControlsProps = {
  question: IeltsQuestion;
  needsOptions: boolean;
  isTrueFalse: boolean;
  isYesNo: boolean;
  isMatching: boolean;
  isDiagramLabeling: boolean;
  trueFalseOptions: BooleanAnswerOption[];
  yesNoOptions: BooleanAnswerOption[];
  defaultTrueFalseValue: string;
  defaultYesNoValue: string;
  onChange: (updated: IeltsQuestion) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onOptionChange: (index: number, value: string) => void;
};

export function QuestionAnswerControls({
  question,
  needsOptions,
  isTrueFalse,
  isYesNo,
  isMatching,
  isDiagramLabeling,
  trueFalseOptions,
  yesNoOptions,
  defaultTrueFalseValue,
  defaultYesNoValue,
  onChange,
  onAddOption,
  onRemoveOption,
  onOptionChange,
}: QuestionAnswerControlsProps) {
  return (
    <>
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
                  onChange={(event) => onOptionChange(index, event.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onRemoveOption(index)}
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
              onClick={onAddOption}
            >
              <Plus className="size-3.5 mr-1" />
              Add Option
            </Button>
          </div>
        </div>
      )}

      {!isMatching && !isDiagramLabeling && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Correct Answer</p>
          {isTrueFalse ? (
            <Select
              value={
                trueFalseOptions.some(
                  (option) =>
                    option.value === normalizeQuestionOptionValue(question.correctAnswer || ''),
                )
                  ? normalizeQuestionOptionValue(question.correctAnswer || '')
                  : defaultTrueFalseValue
              }
              onValueChange={(value) =>
                onChange({
                  ...question,
                  correctAnswer: normalizeQuestionOptionValue(value),
                })
              }
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select answer" />
              </SelectTrigger>
              <SelectContent>
                {trueFalseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : isYesNo ? (
            <Select
              value={
                yesNoOptions.some(
                  (option) =>
                    option.value === normalizeQuestionOptionValue(question.correctAnswer || ''),
                )
                  ? normalizeQuestionOptionValue(question.correctAnswer || '')
                  : defaultYesNoValue
              }
              onValueChange={(value) =>
                onChange({
                  ...question,
                  correctAnswer: normalizeQuestionOptionValue(value),
                })
              }
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Select answer" />
              </SelectTrigger>
              <SelectContent>
                {yesNoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
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
              onChange={(event) => onChange({ ...question, correctAnswer: event.target.value })}
              placeholder="Enter correct answer..."
              className="h-8 text-sm"
            />
          )}
        </div>
      )}
    </>
  );
}
