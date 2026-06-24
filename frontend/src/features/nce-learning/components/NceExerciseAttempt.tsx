/**
 * Location: features/nce-learning/components/NceExerciseAttempt.tsx
 * Purpose: Render a student answer control for one NCE exercise.
 * Why: Students need consistent draft and submit controls for exercise attempts.
 */

import type { NceExercise } from '@features/nce-content/types';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useNceAssetContentQuery } from '../api';
import type { NceAttempt } from '../types';

type Props = {
  courseId: string;
  exercise: NceExercise;
  answer: string;
  attempt: NceAttempt | null;
  isSaving: boolean;
  isSubmitting: boolean;
  onAnswerChange: (value: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
};

type ContentItem = {
  label: string;
  values: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const formatContentLabel = (key: string) => {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
};

const stringifyContentValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return null;
};

const toContentValues = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map(stringifyContentValue)
      .filter((item): item is string => Boolean(item));
  }

  const displayValue = stringifyContentValue(value);
  return displayValue ? [displayValue] : [];
};

const getContentItems = (content: unknown): ContentItem[] => {
  if (!isRecord(content)) {
    return [];
  }

  return Object.entries(content)
    .filter(([key]) => key !== 'audioKey')
    .map(([key, value]) => ({
      label: formatContentLabel(key),
      values: toContentValues(value),
    }))
    .filter((item) => item.values.length > 0);
};

const getAudioKey = (content: unknown) => {
  if (!isRecord(content) || typeof content.audioKey !== 'string') {
    return null;
  }

  const key = content.audioKey.trim();
  return key.length > 0 ? key : null;
};

function NceExerciseAudio({
  courseId,
  audioKey,
}: {
  courseId: string;
  audioKey: string;
}) {
  const contentQuery = useNceAssetContentQuery(courseId, audioKey);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        Audio
      </p>
      {contentQuery.data ? (
        <audio
          controls
          src={contentQuery.data.url}
          aria-label="Exercise audio"
          className="w-full"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {contentQuery.isError ? 'Audio is unavailable.' : 'Loading audio...'}
        </p>
      )}
    </div>
  );
}

export function NceExerciseAttempt({
  courseId,
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
  const contentItems = getContentItems(exercise.content);
  const audioKey = getAudioKey(exercise.content);

  return (
    <div className="rounded-lg border bg-card/70 p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-medium">{exercise.prompt}</p>
        <p className="text-xs uppercase tracking-normal text-muted-foreground">
          {exercise.exerciseType.replace(/_/g, ' ')}
        </p>
      </div>

      {contentItems.length > 0 && (
        <div
          className="space-y-3 rounded-lg border border-dashed bg-background/70 p-3"
          aria-label="Exercise material"
        >
          {contentItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {item.label}
              </p>
              {item.values.length === 1 ? (
                <p className="text-sm leading-6">{item.values[0]}</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                  {item.values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {audioKey && (
        <div className="rounded-lg border border-dashed bg-background/70 p-3">
          <NceExerciseAudio courseId={courseId} audioKey={audioKey} />
        </div>
      )}

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
