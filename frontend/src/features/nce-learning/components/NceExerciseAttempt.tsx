/**
 * Location: features/nce-learning/components/NceExerciseAttempt.tsx
 * Purpose: Render a student answer control for one NCE exercise.
 * Why: Students need consistent draft and submit controls for exercise attempts.
 */

import type { NceExercise } from '@features/nce-content/types';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { NceAttempt } from '../types';

type Props = {
  exercise: NceExercise;
  answer: string;
  attempt: NceAttempt | null;
  isSaving: boolean;
  isSubmitting: boolean;
  onAnswerChange: (value: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
};

export function NceExerciseAttempt({
  exercise,
  answer,
  attempt,
  isSaving,
  isSubmitting,
  onAnswerChange,
  onSaveDraft,
  onSubmit,
}: Props) {
  const submitted = attempt?.status === 'submitted';
  const scoreText =
    submitted && attempt.score !== null && attempt.maxScore !== null
      ? `Score: ${attempt.score}/${attempt.maxScore}`
      : null;

  return (
    <div className="rounded-lg border bg-card/70 p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-medium">{exercise.prompt}</p>
        <p className="text-xs uppercase tracking-normal text-muted-foreground">
          {exercise.exerciseType.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`nce-answer-${exercise.id}`}>
          Answer for {exercise.prompt}
        </Label>
        <Textarea
          id={`nce-answer-${exercise.id}`}
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          disabled={submitted}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={submitted || isSaving || answer.trim().length === 0}
        >
          {isSaving ? 'Saving' : 'Save draft'}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitted || isSubmitting || answer.trim().length === 0}
        >
          {isSubmitting ? 'Submitting' : 'Submit attempt'}
        </Button>
        {attempt?.status === 'draft' && (
          <span className="text-sm text-muted-foreground">Draft saved</span>
        )}
        {scoreText && (
          <span className="text-sm font-medium text-foreground">{scoreText}</span>
        )}
        {submitted && !scoreText && (
          <span className="text-sm text-muted-foreground">Submitted for review</span>
        )}
      </div>
    </div>
  );
}
