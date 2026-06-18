/**
 * Location: features/nce-content/components/NceExerciseEditor.tsx
 * Purpose: Edit one NCE lesson exercise.
 * Why: Centralizes JSON-backed exercise fields and validation messaging.
 */

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Trash2 } from 'lucide-react';
import type { NceExerciseInput, NceExerciseType } from '../types';

const exerciseTypes: NceExerciseType[] = [
  'vocabulary',
  'grammar',
  'listening',
  'speaking',
  'reading',
  'writing',
  'translation',
  'dictation',
  'multiple_choice',
  'gap_fill',
];

type Props = {
  index: number;
  value: NceExerciseInput;
  contentText: string;
  answerKeyText: string;
  scoringConfigText: string;
  onChange: (nextValue: NceExerciseInput) => void;
  onTextChange: (field: 'contentText' | 'answerKeyText' | 'scoringConfigText', value: string) => void;
  onRemove: () => void;
};

export function NceExerciseEditor({
  index,
  value,
  contentText,
  answerKeyText,
  scoringConfigText,
  onChange,
  onTextChange,
  onRemove,
}: Props) {
  const update = <Key extends keyof NceExerciseInput>(
    key: Key,
    nextValue: NceExerciseInput[Key],
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Exercise {index + 1}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove exercise">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`exercise-type-${index}`}>Exercise Type</Label>
          <select
            id={`exercise-type-${index}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.exerciseType}
            onChange={(event) => update('exerciseType', event.target.value as NceExerciseType)}
          >
            {exerciseTypes.map((exerciseType) => (
              <option key={exerciseType} value={exerciseType}>
                {exerciseType.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`exercise-objective-${index}`}>Objective Code</Label>
          <Input
            id={`exercise-objective-${index}`}
            value={value.objectiveCode ?? ''}
            onChange={(event) => update('objectiveCode', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`exercise-order-${index}`}>Sort Order</Label>
          <Input
            id={`exercise-order-${index}`}
            type="number"
            min={0}
            value={value.sortOrder}
            onChange={(event) => update('sortOrder', Number(event.target.value))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`exercise-prompt-${index}`}>Prompt</Label>
        <Textarea
          id={`exercise-prompt-${index}`}
          value={value.prompt}
          onChange={(event) => update('prompt', event.target.value)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`exercise-content-${index}`}>Content JSON</Label>
          <Textarea
            id={`exercise-content-${index}`}
            className="font-mono text-xs"
            value={contentText}
            onChange={(event) => onTextChange('contentText', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`exercise-answer-${index}`}>Answer Key JSON</Label>
          <Textarea
            id={`exercise-answer-${index}`}
            className="font-mono text-xs"
            value={answerKeyText}
            onChange={(event) => onTextChange('answerKeyText', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`exercise-scoring-${index}`}>Scoring Config JSON</Label>
          <Textarea
            id={`exercise-scoring-${index}`}
            className="font-mono text-xs"
            value={scoringConfigText}
            onChange={(event) => onTextChange('scoringConfigText', event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
